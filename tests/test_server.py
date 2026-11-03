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

    def purchase(self, name='Nadia', code='TF-001', amount=250000, key=None):
        return {'firstName':name,'memberCode':code,'amount':amount,'id':key or str(uuid.uuid4())}

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
        self.call('/api/transactions',self.purchase('Bima','TF-002',1000000))
        result=self.call('/api/leaderboard')[1]['customers']
        self.assertEqual([row['firstName'] for row in result],['Bima','Nadia'])
        self.assertEqual(result[1]['total'],750000)
        self.assertEqual(set(result[0]),{'firstName','memberCode','total'})
        app.initialize()  # Reopening storage does not clear transactions.
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'],result)
        self.assertEqual(len(self.call('/api/transactions')[1]['transactions']),3)

    def test_validation_and_conflicting_name(self):
        for fields in [{'amount':-1},{'amount':1.5},{'amount':True},{'amount':1000000000},{'firstName':'Nadia Putri'},{'firstName':'<script>'},{'memberCode':'../x'}]:
            transaction=self.purchase();transaction.update(fields)
            self.assertEqual(self.call('/api/transactions',transaction)[0],400)
        self.call('/api/transactions',self.purchase())
        self.assertEqual(self.call('/api/transactions',self.purchase('Clara'))[0],409)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['total'],250000)

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
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['total'], 250000)
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

    def test_concurrent_duplicate_is_saved_once(self):
        transaction=self.purchase()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results=list(pool.map(lambda _:self.call('/api/transactions',transaction),range(5)))
        self.assertEqual(sum(status==201 for status,_ in results),1)
        self.assertEqual(self.call('/api/leaderboard')[1]['customers'][0]['total'],250000)

if __name__ == '__main__':
    unittest.main()
