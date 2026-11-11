import csv
import io
import os
from unittest.mock import patch
import concurrent.futures
import http.cookiejar
import importlib.util
import json
import hashlib
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import uuid

spec = importlib.util.spec_from_file_location('server', Path(__file__).resolve().parents[1] / 'server.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        app.DB = Path(cls.temp.name) / 'test.sqlite3'
        app.PASSWORD_HASH = hashlib.scrypt(b'test-password-only', salt=app.SALT, n=16384, r=8, p=1)
        app.initialize()
        cls.server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        with app.connect() as db:
            db.execute('DELETE FROM settings')
            db.execute('DELETE FROM purchases')
            db.execute('DELETE FROM customers')
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.call('/api/login', {'password':'test-password-only'})

    def call(self, path, data=None, client=None, headers=None):
        request = urllib.request.Request(self.base+path, data=json.dumps(data).encode() if data is not None else None,
          headers=headers or ({'Content-Type':'application/json', 'X-Toy-Admin':'1'} if data is not None else {}))
        try:
            response=(client or self.client).open(request)
        except urllib.error.HTTPError as error:
            response=error
        return response.status, json.loads(response.read())

    def purchase(self, name='Nadia', code='TF-001', amount=500000, key=None, category='fnb'):
        return {'firstName':name,'memberCode':code,'amount':amount,'category':category,'id':key or str(uuid.uuid4())}

    def test_authentication_csrf_and_private_files(self):
        anonymous=urllib.request.build_opener()
        self.assertEqual(self.call('/api/transactions', client=anonymous)[0],401)
        self.assertEqual(self.call('/api/transactions',self.purchase(),client=anonymous)[0],401)
        self.assertEqual(self.call('/api/login',{'password':'wrong'})[0],401)
        self.assertEqual(self.call('/api/transactions',self.purchase(),headers={'Content-Type':'application/json'})[0],403)
        self.assertEqual(self.call('/api/transactions',self.purchase(),headers={'Content-Type':'application/json','X-Toy-Admin':'1','Origin':'https://attacker.example'})[0],403)
        for path in ['/.data/leaderboard.sqlite3','/server.py','/../server.py']:
            self.assertEqual(self.call(path)[0],404)
        self.call('/api/logout',{})
        self.assertEqual(self.call('/api/transactions')[0],401)

    def test_totals_sort_idempotency_and_persistence(self):
        transaction=self.purchase()
        self.assertEqual(self.call('/api/transactions',transaction)[0],201)
        self.assertTrue(self.call('/api/transactions',transaction)[1]['duplicate'])
        self.call('/api/transactions',self.purchase(amount=500000))
        self.call('/api/transactions',self.purchase('Bima','TF-002',1500000))
        result=self.call('/api/leaderboard')[1]['customers']
        self.assertEqual([row['firstName'] for row in result],['Bima','Nadia'])
        self.assertEqual(result[1]['points'],20)
        self.assertEqual(set(result[0]),{'firstName','memberCode','points'})
        app.initialize()  # Reopening storage does not clear transactions.
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'],result)
        self.assertEqual(len(self.call('/api/transactions')[1]['transactions']),3)

    def test_validation_and_conflicting_name(self):
        for fields in [{'amount':-1},{'amount':1.5},{'amount':True},{'amount':1000000000},{'firstName':'Nadia Putri'},{'firstName':'<script>'},{'memberCode':'../x'}]:
            transaction=self.purchase();transaction.update(fields)
            self.assertEqual(self.call('/api/transactions',transaction)[0],400)
        self.call('/api/transactions',self.purchase())
        self.assertEqual(self.call('/api/transactions',self.purchase('Clara'))[0],409)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],10)

    def test_countdown_deadline_enforces_closure_and_reopens(self):
        transaction = self.purchase()
        self.call('/api/transactions', transaction)
        status, state = self.call('/api/collection', {'deadline': '2001-12-12T23:59:00+07:00'})
        self.assertEqual(status, 200)
        self.assertTrue(state['closed'])
        self.assertEqual(state['deadline'], '2001-12-12T16:59:00+00:00')
        self.assertEqual(self.call('/api/transactions', self.purchase(amount=500000))[0], 423)
        self.assertTrue(self.call('/api/transactions', transaction)[1]['duplicate'])
        app.initialize()
        self.assertTrue(self.call('/api/leaderboard')[1]['collection']['closed'])
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'], 10)
        self.call('/api/collection', {'deadline': '2099-12-12T23:59:00+09:00'})
        self.assertFalse(self.call('/api/collection')[1]['closed'])
        self.assertEqual(self.call('/api/transactions', self.purchase(amount=500000))[0], 201)
        self.call('/api/collection', {'deadline': None})
        self.assertIsNone(self.call('/api/collection')[1]['deadline'])

    def test_countdown_auth_and_validation(self):
        anonymous = urllib.request.build_opener()
        self.assertEqual(self.call('/api/collection', {'deadline': None}, client=anonymous)[0], 401)
        for data in [{}, {'deadline': 123}, {'deadline': 'invalid'},
                     {'deadline': '2026-12-12T23:59:00'}, {'deadline': '2026-02-30T12:00:00+07:00'}]:
            self.assertEqual(self.call('/api/collection', data)[0], 400)
        self.assertIsNone(self.call('/api/collection')[1]['deadline'])

    def fetch_raw(self, path, client=None):
        try:
            response = (client or self.client).open(self.base + path)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, response.headers, response.read()

    def test_exports_include_all_rows_and_all_members(self):
        with app.connect() as db:
            for index in range(12):
                db.execute('INSERT INTO customers(code,name) VALUES(?,?)', (f'TF-{index:03}', 'Nadia'))
            for index in range(125):
                db.execute('INSERT INTO purchases(id,code,amount) VALUES(?,?,?)',
                           (str(uuid.uuid4()), f'TF-{index%12:03}', index+1))
        anonymous = urllib.request.build_opener()
        for path in ['/api/export/transactions.csv', '/api/export/members.csv']:
            self.assertEqual(self.fetch_raw(path, anonymous)[0], 401)
        status, headers, body = self.fetch_raw('/api/export/transactions.csv')
        self.assertEqual(status, 200)
        self.assertTrue(body.startswith(b'\xef\xbb\xbf'))
        self.assertIn('attachment;', headers['Content-Disposition'])
        self.assertEqual(headers['Cache-Control'], 'no-store')
        records = list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))))
        self.assertEqual(len(records), 125)
        self.assertEqual(sum(int(row['Nominal IDR']) for row in records), sum(range(1,126)))
        self.assertTrue(all('+07:00' in row['Waktu WIB'] for row in records))
        records = list(csv.DictReader(io.StringIO(self.fetch_raw('/api/export/members.csv')[2].decode('utf-8-sig'))))
        self.assertEqual(len(records), 12)
        self.assertEqual(sum(int(row['Jumlah Transaksi']) for row in records), 125)
        self.assertEqual(sum(int(row['Total IDR']) for row in records), sum(range(1,126)))
        self.assertTrue(all(row['Peringkat']=='' for row in records))
        self.assertEqual(sum(int(row['Transaksi Belum Dikategorikan']) for row in records),125)
        self.assertTrue(all(row['Total Poin']=='0' for row in records))

    def test_csv_formula_protection_and_empty_export(self):
        self.assertEqual(len(list(csv.reader(io.StringIO(self.fetch_raw('/api/export/transactions.csv')[2].decode('utf-8-sig'))))), 1)
        self.call('/api/transactions', self.purchase('Élodie', '-123', 250000))
        records = list(csv.DictReader(io.StringIO(self.fetch_raw('/api/export/transactions.csv')[2].decode('utf-8-sig'))))
        self.assertEqual(records[0]['Nama Depan'], 'Élodie')
        self.assertEqual(records[0]['Member Code'], "'-123")
        for value in ['=1+1', '+1', '-1', '@SUM(A1)', '\tformula', '  =1']:
            self.assertTrue(app.csv_cell(value).startswith("'"))
        self.assertEqual(app.csv_cell('TF-001'), 'TF-001')
        self.assertEqual(app.csv_cell('00123'), "'00123")
        self.assertEqual(app.csv_cell(250000), 250000)

    def test_public_share_qr_and_health(self):
        anonymous = urllib.request.build_opener()
        self.assertEqual(self.call('/healthz', client=anonymous), (200, {'ok': True}))
        for path in ['/api/share', '/api/share/qr.svg']:
            self.assertEqual(self.fetch_raw(path, anonymous)[0], 401)
        with patch.dict(os.environ, {'PUBLIC_URL': '', 'RENDER_EXTERNAL_URL': ''}):
            self.assertIsNone(self.call('/api/share')[1]['publicUrl'])
            self.assertEqual(self.fetch_raw('/api/share/qr.svg')[0], 409)
        with patch.dict(os.environ, {'PUBLIC_URL': '', 'RENDER_EXTERNAL_URL': 'https://toy-example.onrender.com'}):
            self.assertEqual(self.call('/api/share')[1]['publicUrl'], 'https://toy-example.onrender.com/')
            status, headers, svg = self.fetch_raw('/api/share/qr.svg')
            self.assertEqual(status, 200)
            self.assertEqual(headers['Content-Type'], 'image/svg+xml')
            self.assertIn(b'<svg', svg)
            self.assertIn(b'<path', svg)
        for value in ['http://example.com', 'https://example.com/admin', 'https://user:pass@example.com', 'https://localhost', 'https://example.com?token=secret']:
            with patch.dict(os.environ, {'PUBLIC_URL': value}):
                self.assertIsNone(app.public_url())

    def test_points_use_tariff_groups_not_nominal_ranking(self):
        # A smaller Fashion purchase earns more points than a larger electronic purchase.
        self.assertEqual(self.call('/api/transactions', self.purchase('Nadia','TF-001',500000,category='fashion'))[1]['memberPoints'], 10)
        self.assertEqual(self.call('/api/transactions', self.purchase('Bima','TF-002',1000000,category='electronics'))[1]['memberPoints'], 2)
        result = self.call('/api/leaderboard')[1]['customers']
        self.assertEqual([(r['firstName'],r['points']) for r in result], [('Nadia',10),('Bima',2)])
        self.assertEqual(self.call('/api/transactions', self.purchase('Clara','TF-003',500000,category='jewelry'))[1]['memberPoints'], 1)
        self.assertEqual(self.call('/api/transactions', self.purchase('Dewi','TF-004',500000,category='fnb'))[1]['memberPoints'], 10)

    def test_points_round_down_per_receipt_without_combining_remainders(self):
        for category in ['fnb','fashion']:
            self.call('/api/transactions', self.purchase(amount=525000,category=category))
        for category in ['electronics','jewelry']:
            self.call('/api/transactions', self.purchase(amount=750000,category=category))
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],22)
        for amount in [30000,30000,490000]:
            result=self.call('/api/transactions', self.purchase(amount=amount,category='fnb'))
            self.assertEqual(result[0],201)
            self.assertEqual(result[1]['transactionPoints'],0)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],22)
        data=list(csv.DictReader(io.StringIO(self.fetch_raw('/api/export/members.csv')[2].decode('utf-8-sig'))))[0]
        self.assertEqual(data['Total Poin'],'22')
        self.assertEqual(data['Struk Memenuhi Minimum'],'4')
        self.assertEqual(data['Struk di Bawah Minimum'],'3')
        transactions=list(csv.DictReader(io.StringIO(self.fetch_raw('/api/export/transactions.csv')[2].decode('utf-8-sig'))))
        self.assertEqual(sum(int(row['Poin Struk']) for row in transactions),22)
        self.call('/api/transactions', self.purchase('Aditya','TF-000',1100000,category='fnb'))
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['memberCode'],'TF-000')

    def test_minimum_applies_per_receipt_to_every_category(self):
        for category in ['fnb','fashion','electronics','jewelry']:
            for amount in [1,30000,499999]:
                result=self.call('/api/transactions', self.purchase(amount=amount,category=category))
                self.assertEqual(result[1]['transactionPoints'],0)
                self.assertFalse(result[1]['eligible'])
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'],[])
        for category, points in [('fnb',10),('fashion',10),('electronics',1),('jewelry',1)]:
            result=self.call('/api/transactions', self.purchase(amount=500000,category=category))
            self.assertEqual(result[1]['transactionPoints'],points)
            self.assertTrue(result[1]['eligible'])
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],22)
        self.assertEqual(len(self.call('/api/transactions')[1]['transactions']),16)

    def test_category_validation_and_duplicate_payload(self):
        for category in [None, 'unknown', 123, {}, []]:
            self.assertEqual(self.call('/api/transactions', self.purchase(category=category))[0],400)
        transaction=self.purchase(category='fnb')
        self.call('/api/transactions', transaction)
        transaction['category']='electronics'
        self.assertEqual(self.call('/api/transactions', transaction)[0],409)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],10)

    def test_legacy_purchases_are_preserved_and_require_classification(self):
        key=str(uuid.uuid4())
        with app.connect() as db:
            db.execute("INSERT INTO customers(code,name) VALUES('TF-001','Nadia')")
            db.execute("INSERT INTO purchases(id,code,amount) VALUES(?,'TF-001',500000)",(key,))
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'],[])
        self.assertEqual(self.call('/api/uncategorized')[1]['count'],1)
        self.assertEqual(self.call('/api/uncategorized',client=urllib.request.build_opener())[0],401)
        self.assertEqual(self.call('/api/transactions/classify',{'id':key,'category':'fnb'},client=urllib.request.build_opener())[0],401)
        self.assertEqual(self.call('/api/transactions/classify',{'id':key,'category':'invalid'})[0],400)
        self.assertEqual(self.call('/api/transactions/classify',{'id':'missing','category':'fnb'})[0],404)
        self.call('/api/collection',{'deadline':'2001-01-01T00:00:00+07:00'})
        self.assertEqual(self.call('/api/transactions/classify',{'id':key,'category':'electronics'})[0],200)
        self.assertEqual(self.call('/api/transactions/classify',{'id':key,'category':'electronics'})[0],200)
        self.assertEqual(self.call('/api/transactions/classify',{'id':key,'category':'fnb'})[0],409)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],1)
        self.assertEqual(self.call('/api/uncategorized')[1]['count'],0)
        self.assertEqual(len(self.call('/api/transactions')[1]['transactions']),1)
        self.assertEqual(self.call('/api/transactions')[1]['transactions'][0]['amount'],500000)

    def test_original_database_schema_is_migrated_idempotently(self):
        legacy=Path(self.temp.name)/('legacy-'+str(uuid.uuid4())+'.sqlite3')
        with patch.object(app,'DB',legacy):
            with app.connect() as db:
                db.executescript("CREATE TABLE customers(code TEXT PRIMARY KEY,name TEXT NOT NULL);"
                    "CREATE TABLE purchases(id TEXT PRIMARY KEY,code TEXT,amount INTEGER,created_at TEXT);"
                    "INSERT INTO customers VALUES('TF-001','Nadia');"
                    "INSERT INTO purchases VALUES('legacy-transaction','TF-001',30000,'2026-11-01T00:00:00Z');")
            app.initialize();app.initialize()
            with app.connect() as db:
                row=db.execute('SELECT * FROM purchases').fetchone()
                self.assertEqual(row['amount'],30000)
                self.assertIsNone(row['category'])
                self.assertEqual(db.execute('SELECT COUNT(*) FROM purchases').fetchone()[0],1)

    def test_concurrent_duplicate_is_saved_once(self):
        transaction=self.purchase()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results=list(pool.map(lambda _:self.call('/api/transactions',transaction),range(5)))
        self.assertEqual(sum(status==201 for status,_ in results),1)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['points'],10)

if __name__ == '__main__':
    unittest.main()
