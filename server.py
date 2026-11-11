"""Toy Factory single-instance server. Python 3.12+; QR generation uses the pinned qrcode package."""
from datetime import datetime, timezone, timedelta
import csv
import io
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
CATEGORIES = {'fnb': ('F&B', 50_000), 'fashion': ('Fashion', 50_000),
              'electronics': ('Elektronik', 500_000), 'jewelry': ('Perhiasan', 500_000)}
MIN_RECEIPT = 500_000
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
          CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS customers(code TEXT PRIMARY KEY, name TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS purchases(
            id TEXT PRIMARY KEY, code TEXT NOT NULL REFERENCES customers(code),
            amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL
            DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        ''')
        columns = {row['name'] for row in db.execute('PRAGMA table_info(purchases)')}
        if 'category' not in columns:
            db.execute('ALTER TABLE purchases ADD COLUMN category TEXT')


def receipt_points(amount, category):
    if category not in CATEGORIES:
        return None
    if amount < MIN_RECEIPT:
        return 0
    return amount // CATEGORIES[category][1]


def standings(db):
    return db.execute("""SELECT c.name AS firstName,c.code AS memberCode,COUNT(*) AS count,
      SUM(amount) AS total,COUNT(category) AS categorizedCount,
      SUM(CASE WHEN category IN ('fnb','fashion') THEN amount ELSE 0 END) AS standardTotal,
      SUM(CASE WHEN category IN ('electronics','jewelry') THEN amount ELSE 0 END) AS premiumTotal,
      SUM(CASE WHEN category IS NULL THEN 1 ELSE 0 END) AS pendingCount,
      SUM(CASE WHEN amount>=500000 AND category IS NOT NULL THEN 1 ELSE 0 END) AS eligibleCount,
      SUM(CASE WHEN amount<500000 THEN 1 ELSE 0 END) AS belowMinimumCount,
      SUM(CASE WHEN amount>=500000 AND category IN ('fnb','fashion') THEN amount/50000
               WHEN amount>=500000 AND category IN ('electronics','jewelry') THEN amount/500000
               ELSE 0 END) AS points
      FROM purchases p JOIN customers c ON p.code=c.code GROUP BY c.code
      ORDER BY (SUM(CASE WHEN amount>=500000 AND category IS NOT NULL THEN 1 ELSE 0 END)>0) DESC,
               points DESC,c.code ASC""").fetchall()


def collection_state(db):
    row = db.execute("SELECT value FROM settings WHERE key='collection_deadline'").fetchone()
    deadline = row['value'] if row else None
    now = datetime.now(timezone.utc)
    return {'deadline': deadline, 'serverNow': now.isoformat(),
            'closed': bool(deadline and datetime.fromisoformat(deadline) <= now)}


def public_url():
    raw = os.environ.get('PUBLIC_URL') or os.environ.get('RENDER_EXTERNAL_URL', '')
    try:
        if len(raw) > 512:
            return None
        parsed = urlsplit(raw)
        hostname = parsed.hostname
        parsed.port  # Validate a configured port, if any.
    except ValueError:
        return None
    if (parsed.scheme != 'https' or not hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path not in ('', '/')
            or parsed.hostname in ('localhost', '127.0.0.1')):
        return None
    return raw.rstrip('/') + '/'


def csv_cell(value):
    # Spreadsheet programs must not execute customer identifiers as formulas.
    if isinstance(value, str) and (value.lstrip().startswith(('=', '+', '-', '@'))
                                 or value.startswith(('\t', '\r', '\n'))
                                 or (value.isdigit() and value.startswith('0'))):
        return "'" + value
    return value


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

    def download_csv(self, kind):
        if not self.authorized():
            return self.reply(401, {'error': 'Silakan masuk kembali.'})
        output = io.StringIO(newline='')
        writer = csv.writer(output)
        with connect() as db:
            if kind == 'transactions':
                writer.writerow(['ID Transaksi', 'Waktu UTC', 'Waktu WIB', 'Nama Depan', 'Member Code', 'Nominal IDR', 'Kategori', 'Tarif IDR per Poin', 'Poin Struk', 'Status Poin'])
                rows = db.execute("SELECT p.id,p.created_at,c.name,c.code,p.amount,p.category FROM purchases p "
                                  "JOIN customers c ON p.code=c.code ORDER BY p.rowid ASC")
                for row in rows:
                    wib = datetime.fromisoformat(row['created_at'].replace('Z', '+00:00')).astimezone(
                        timezone(timedelta(hours=7))).isoformat()
                    writer.writerow([csv_cell(v) for v in (row['id'], row['created_at'], wib, row['name'], row['code'], row['amount'],
                        CATEGORIES[row['category']][0] if row['category'] in CATEGORIES else 'Belum dikategorikan',
                        CATEGORIES[row['category']][1] if row['category'] in CATEGORIES else '',
                        receipt_points(row['amount'], row['category']) if row['category'] in CATEGORIES else '',
                        'Belum dikategorikan' if row['category'] not in CATEGORIES else
                        'Di bawah minimum Rp500000' if row['amount'] < MIN_RECEIPT else 'Memenuhi minimum')])
            else:
                writer.writerow(['Peringkat', 'Nama Depan', 'Member Code', 'Jumlah Transaksi', 'Total IDR',
                                 'Total Poin', 'Belanja Kelompok 50000', 'Belanja Kelompok 500000',
                                 'Struk Memenuhi Minimum', 'Struk di Bawah Minimum', 'Transaksi Belum Dikategorikan'])
                rank = 0
                for row in standings(db):
                    if row['eligibleCount']:
                        rank += 1
                    writer.writerow([csv_cell(v) for v in (rank if row['eligibleCount'] else '', row['firstName'],
                        row['memberCode'], row['count'], row['total'], row['points'], row['standardTotal'],
                        row['premiumTotal'], row['eligibleCount'], row['belowMinimumCount'],
                        row['pendingCount'])])
        body = output.getvalue().encode('utf-8-sig')
        self.send_response(200)
        self.send_header('Content-Type', 'text/csv; charset=utf-8')
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        self.send_header('Content-Disposition', f'attachment; filename="toy-factory-{kind}-{stamp}.csv"')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
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
        if route == '/healthz':
            with connect() as db:
                db.execute('SELECT 1 FROM settings LIMIT 1').fetchall()
            return self.reply(200, {'ok': True})
        if route in ('/api/export/transactions.csv', '/api/export/members.csv'):
            return self.download_csv('transactions' if route.endswith('transactions.csv') else 'members')
        if route in ('/api/share', '/api/share/qr.svg'):
            if not self.authorized():
                return self.reply(401, {'error': 'Silakan masuk kembali.'})
            url = public_url()
            if route == '/api/share':
                return self.reply(200, {'publicUrl': url, 'screenUrl': url + '?display=screen' if url else None})
            if not url:
                return self.reply(409, {'error': 'Alamat HTTPS publik belum dikonfigurasi di hosting.'})
            import qrcode
            import qrcode.image.svg
            qr = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=4)
            body = qr.to_string()
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            self.send_header('Content-Disposition', 'inline; filename="toy-factory-qr.svg"')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if route == '/api/leaderboard':
            with connect() as db:
                rows = [row for row in standings(db) if row['eligibleCount'] > 0][:10]
                collection = collection_state(db)
            customers = [{'firstName': row['firstName'], 'memberCode': row['memberCode'],
                          'points': row['points']} for row in rows]
            return self.reply(200, {'customers': customers, 'collection': collection})
        if route == '/api/collection':
            with connect() as db:
                state = collection_state(db)
            return self.reply(200, state)
        if route == '/api/session':
            return self.reply(200, {'authenticated': self.authorized()})
        if route == '/api/uncategorized':
            if not self.authorized():
                return self.reply(401, {'error': 'Silakan masuk kembali.'})
            with connect() as db:
                count = db.execute('SELECT COUNT(*) FROM purchases WHERE category IS NULL').fetchone()[0]
                rows = db.execute('''SELECT p.id,c.name AS firstName,c.code AS memberCode,p.amount,
                  p.created_at AS createdAt FROM purchases p JOIN customers c ON c.code=p.code
                  WHERE p.category IS NULL ORDER BY p.rowid ASC LIMIT 100''').fetchall()
            return self.reply(200, {'count': count, 'transactions': [dict(row) for row in rows]})
        if route == '/api/transactions':
            if not self.authorized():
                return self.reply(401, {'error': 'Silakan masuk kembali.'})
            with connect() as db:
                rows = db.execute('''SELECT p.id, c.name AS firstName, c.code AS memberCode,
                  amount, category, created_at AS createdAt FROM purchases p JOIN customers c ON c.code=p.code
                  ORDER BY p.rowid DESC LIMIT 100''').fetchall()
            return self.reply(200, {'transactions': [{**dict(row), 'points': receipt_points(row['amount'], row['category'])} for row in rows]})
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
        if route == '/api/collection':
            deadline = data.get('deadline')
            if 'deadline' not in data:
                return self.reply(400, {'error': 'Batas waktu wajib dikirim; null untuk menonaktifkan timer.'})
            if deadline is not None:
                try:
                    if not isinstance(deadline, str) or len(deadline) > 40:
                        raise ValueError()
                    parsed = datetime.fromisoformat(deadline)
                    if parsed.tzinfo is None or not 2000 <= parsed.year <= 2100:
                        raise ValueError()
                    deadline = parsed.astimezone(timezone.utc).isoformat()
                except (ValueError, OverflowError):
                    return self.reply(400, {'error': 'Tanggal batas waktu tidak valid atau zona waktu belum ditentukan.'})
            with connect() as db:
                db.execute('BEGIN IMMEDIATE')
                if deadline is None:
                    db.execute("DELETE FROM settings WHERE key='collection_deadline'")
                else:
                    db.execute("INSERT INTO settings(key,value) VALUES('collection_deadline',?) "
                               "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (deadline,))
                state = collection_state(db)
            return self.reply(200, state)
        if route == '/api/transactions/classify':
            key, category = data.get('id'), data.get('category')
            if not isinstance(key, str) or not isinstance(category, str) or category not in CATEGORIES:
                return self.reply(400, {'error': 'ID transaksi atau kategori tidak valid.'})
            with connect() as db:
                db.execute('BEGIN IMMEDIATE')
                existing = db.execute('SELECT category FROM purchases WHERE id=?', (key,)).fetchone()
                if not existing:
                    return self.reply(404, {'error': 'Transaksi tidak ditemukan.'})
                if existing['category'] is not None and existing['category'] != category:
                    return self.reply(409, {'error': 'Kategori transaksi ini sudah ditetapkan.'})
                db.execute('UPDATE purchases SET category=? WHERE id=? AND category IS NULL', (category, key))
            return self.reply(200, {'ok': True})
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
        category = data.get('category')
        if not isinstance(category, str) or category not in CATEGORIES:
            return self.reply(400, {'error': 'Pilih kategori F&B, Fashion, Elektronik, atau Perhiasan.'})
        code = code.upper()
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT code, amount, category FROM purchases WHERE id=?', (key,)).fetchone()
            customer = db.execute('SELECT name FROM customers WHERE code=?', (code,)).fetchone()
            if previous:
                if previous['code'] != code or previous['amount'] != amount or previous['category'] != category or not customer or customer['name'] != name:
                    return self.reply(409, {'error': 'ID transaksi sudah dipakai untuk data berbeda.'})
                member = next(row for row in standings(db) if row['memberCode'] == code)
                return self.reply(200, {'ok': True, 'duplicate': True, 'memberPoints': member['points'],
                    'transactionPoints': receipt_points(amount, category), 'eligible': amount >= MIN_RECEIPT})
            if collection_state(db)['closed']:
                return self.reply(423, {'error': 'Pengumpulan struk sudah ditutup. Admin perlu memperpanjang batas waktu sebelum menambah transaksi.'})
            if customer and customer['name'] != name:
                return self.reply(409, {'error': f'Member code ini sudah terdaftar atas nama {customer["name"]}. Gunakan nama yang sama.'})
            total = db.execute('SELECT COALESCE(SUM(amount),0) FROM purchases WHERE code=?', (code,)).fetchone()[0]
            if total + amount > MAX_TOTAL:
                return self.reply(400, {'error': 'Total member melebihi batas Rp999.999.999.'})
            db.execute('INSERT OR IGNORE INTO customers(code,name) VALUES(?,?)', (code, name))
            db.execute('INSERT INTO purchases(id,code,amount,category) VALUES(?,?,?,?)', (key, code, amount, category))
            member = next(row for row in standings(db) if row['memberCode'] == code)
        return self.reply(201, {'ok': True, 'duplicate': False, 'memberPoints': member['points'],
                    'transactionPoints': receipt_points(amount, category), 'eligible': amount >= MIN_RECEIPT})


if __name__ == '__main__':
    password = os.environ.get('ADMIN_PASSWORD')
    if not password and not __import__('sys').stdin.isatty():
        raise SystemExit('Tetapkan ADMIN_PASSWORD di environment hosting (minimal 12 karakter).')
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
