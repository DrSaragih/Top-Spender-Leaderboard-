"""Toy Factory single-instance server. Python 3.12+, no third-party dependencies."""
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('DATABASE_PATH', ROOT / '.data' / 'leaderboard.sqlite3'))
MAX_TOTAL = 999_999_999  # Whole rupiah; keeps signage totals readable.
SESSIONS = {}
ATTEMPTS = {}
LOCK = threading.Lock()
PASSWORD_HASH = b''
SALT = secrets.token_bytes(32)


def connect():
    db = sqlite3.connect(DB, timeout=15)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
          CREATE TABLE IF NOT EXISTS customers(code TEXT PRIMARY KEY, name TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS purchases(
            id TEXT PRIMARY KEY, code TEXT NOT NULL REFERENCES customers(code),
            amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL
            DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        ''')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log passwords, bodies or cookies.

    def reply(self, status, value, cookie=None):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def token(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
            return jar['toy_admin'].value if 'toy_admin' in jar else ''
        except cookies.CookieError:
            return ''

    def authorized(self):
        with LOCK:
            now = time.time()
            for token in list(SESSIONS):
                if SESSIONS[token] <= now:
                    del SESSIONS[token]
            return SESSIONS.get(self.token(), 0) > now

    def session_cookie(self, token, age):
        secure = '; Secure' if os.environ.get('COOKIE_SECURE') == '1' else ''
        return f'toy_admin={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{secure}'

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == '/api/leaderboard':
            with connect() as db:
                rows = db.execute('''SELECT name AS firstName, c.code AS memberCode,
                  SUM(amount) AS total FROM customers c JOIN purchases p ON c.code=p.code
                  GROUP BY c.code ORDER BY total DESC, c.code ASC LIMIT 10''').fetchall()
            return self.reply(200, {'customers': [dict(r) for r in rows]})
        if route == '/api/session':
            return self.reply(200, {'authenticated': self.authorized()})
        if route == '/api/transactions':
            if not self.authorized():
                return self.reply(401, {'error': 'Silakan masuk kembali.'})
            with connect() as db:
                rows = db.execute('''SELECT p.id, c.name AS firstName, c.code AS memberCode,
                  amount, created_at AS createdAt FROM purchases p JOIN customers c ON c.code=p.code
                  ORDER BY p.rowid DESC LIMIT 100''').fetchall()
            return self.reply(200, {'transactions': [dict(r) for r in rows]})
        # Explicit allowlist prevents exposing SQLite, source, or credentials.
        files = {'/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html',
                 '/admin.html': 'admin.html', '/admin.js': 'admin.js', '/leaderboard.js': 'leaderboard.js'}
        if route.startswith('/assets/') and route.removeprefix('/assets/') in {
            'teddy-bear.svg', 'rocking-horse.svg', 'toy-blocks.svg'}:
            files[route] = route.lstrip('/')
        if route not in files:
            return self.reply(404, {'error': 'Halaman tidak ditemukan.'})
        file = ROOT / files[route]
        body = file.read_bytes()
        mime = {'html': 'text/html', 'js': 'text/javascript', 'svg': 'image/svg+xml'}[file.suffix[1:]]
        self.send_response(200)
        self.send_header('Content-Type', mime + '; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # JSON + custom header prevents cross-site form submissions; no CORS enabled.
        origin = self.headers.get('Origin')
        if (self.headers.get('X-Toy-Admin') != '1' or
            self.headers.get('Content-Type', '').split(';')[0] != 'application/json' or
            (origin and urlsplit(origin).netloc != self.headers.get('Host'))):
            return self.reply(403, {'error': 'Permintaan tidak diizinkan.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, {'error': 'Format permintaan tidak valid.'})
        route = urlsplit(self.path).path
        if route == '/api/login':
            address = self.client_address[0]
            with LOCK:
                now = time.time()
                for key in list(ATTEMPTS):
                    ATTEMPTS[key] = [t for t in ATTEMPTS[key] if now-t < 300]
                    if not ATTEMPTS[key]:
                        del ATTEMPTS[key]
                attempts = ATTEMPTS.setdefault(address, [])
                if len(attempts) >= 10:
                    return self.reply(429, {'error': 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.'})
                attempts.append(now)
            password = data.get('password', '')
            valid = isinstance(password, str) and len(password) <= 1024
            digest = hashlib.scrypt(password.encode() if valid else b'', salt=SALT, n=16384, r=8, p=1)
            if not valid or not hmac.compare_digest(digest, PASSWORD_HASH):
                return self.reply(401, {'error': 'Kata sandi salah.'})
            token = secrets.token_urlsafe(32)
            with LOCK:
                ATTEMPTS.pop(address, None)
                SESSIONS[token] = time.time() + 43200
            return self.reply(200, {'ok': True}, self.session_cookie(token, 43200))
        if not self.authorized():
            return self.reply(401, {'error': 'Silakan masuk kembali.'})
        if route == '/api/logout':
            with LOCK:
                SESSIONS.pop(self.token(), None)
            return self.reply(200, {'ok': True}, self.session_cookie('', 0))
        if route != '/api/transactions':
            return self.reply(404, {'error': 'Endpoint tidak ditemukan.'})
        name, code, amount, key = (data.get(k) for k in ('firstName', 'memberCode', 'amount', 'id'))
        if not isinstance(name, str) or not 1 <= len(name) <= 40 or not all(c.isalpha() or c in "'-" for c in name) or not any(c.isalpha() for c in name):
            return self.reply(400, {'error': 'Isi nama depan saja (maksimal 40 huruf, tanpa spasi).'})
        if not isinstance(code, str) or not re.fullmatch(r'[A-Za-z0-9-]{1,24}', code):
            return self.reply(400, {'error': 'Member code: 1–24 huruf, angka, atau tanda hubung.'})
        if type(amount) is not int or not 1 <= amount <= MAX_TOTAL:
            return self.reply(400, {'error': 'Nominal harus rupiah bulat positif, maksimal Rp999.999.999.'})
        if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9-]{16,64}', key):
            return self.reply(400, {'error': 'ID transaksi tidak valid. Muat ulang halaman admin.'})
        code = code.upper()
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT code, amount FROM purchases WHERE id=?', (key,)).fetchone()
            customer = db.execute('SELECT name FROM customers WHERE code=?', (code,)).fetchone()
            if previous:
                if previous['code'] != code or previous['amount'] != amount or not customer or customer['name'] != name:
                    return self.reply(409, {'error': 'ID transaksi sudah dipakai untuk data berbeda.'})
                return self.reply(200, {'ok': True, 'duplicate': True})
            if customer and customer['name'] != name:
                return self.reply(409, {'error': f'Member code ini sudah terdaftar atas nama {customer["name"]}. Gunakan nama yang sama.'})
            total = db.execute('SELECT COALESCE(SUM(amount),0) FROM purchases WHERE code=?', (code,)).fetchone()[0]
            if total + amount > MAX_TOTAL:
                return self.reply(400, {'error': 'Total member melebihi batas Rp999.999.999.'})
            db.execute('INSERT OR IGNORE INTO customers(code,name) VALUES(?,?)', (code, name))
            db.execute('INSERT INTO purchases(id,code,amount) VALUES(?,?,?)', (key, code, amount))
        return self.reply(201, {'ok': True, 'duplicate': False})


if __name__ == '__main__':
    password = os.environ.get('ADMIN_PASSWORD')
    if not password:
        password = getpass.getpass('Buat kata sandi admin (minimal 12 karakter): ')
    if len(password) < 12 or len(password) > 1024:
        raise SystemExit('ADMIN_PASSWORD harus berisi 12–1024 karakter.')
    PASSWORD_HASH = hashlib.scrypt(password.encode(), salt=SALT, n=16384, r=8, p=1)
    del password
    initialize()
    port = int(os.environ.get('PORT', '8000'))
    server = ThreadingHTTPServer((os.environ.get('HOST', '0.0.0.0'), port), Handler)
    print(f'Toy Factory server started on port {port}. Admin route: /admin', flush=True)
    server.serve_forever()
