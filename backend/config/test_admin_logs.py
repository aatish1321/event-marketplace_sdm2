"""Admin crash-log review is role-guarded and paginated."""

import datetime
import time

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import SystemLog
from config.tests import BaseMongoTestCase


class AdminLogTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(override_settings(
            ALLOWED_HOSTS=['testserver'],
            SECRET_KEY='admin-log-tests-only-signing-key-at-least-32-bytes',
        ))
        self.client = Client()
        start = datetime.datetime(2030, 1, 1)
        for minute in range(5):
            SystemLog(level='ERROR', endpoint=f'/api/{minute}/', method='GET', status_code=500,
                      message=f'boom {minute}', traceback='Traceback...',
                      timestamp=start + datetime.timedelta(minutes=minute)).save()

    def get(self, query='', role='admin'):
        payload = {'user_id': 'u1', 'role': role, 'iat': int(time.time()) - 1, 'exp': int(time.time()) + 3600}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        return self.client.get(f'/api/admin/logs/{query}', HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_non_admins_are_forbidden(self):
        self.assertEqual(self.client.get('/api/admin/logs/').status_code, 403)
        for role in ('attendee', 'organizer'):
            self.assertEqual(self.get(role=role).status_code, 403)

    def test_paginates_newest_first_and_is_uncached(self):
        response = self.get('?limit=2&offset=1')
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response.headers['Cache-Control'])
        data = response.json()
        self.assertEqual((data['count'], data['limit'], data['offset']), (5, 2, 1))
        self.assertEqual([log['message'] for log in data['results']], ['boom 3', 'boom 2'])
        self.assertEqual(data['results'][0]['traceback'], 'Traceback...')
        self.assertEqual(data['results'][0]['timestamp'], '2030-01-01T00:03:00Z')

    def test_defaults_and_offset_past_end(self):
        self.assertEqual(len(self.get().json()['results']), 5)
        self.assertEqual(self.get('?offset=99').json()['results'], [])

    def test_rejects_invalid_pagination(self):
        for query in ('?limit=0', '?limit=101', '?limit=-1', '?offset=-1', '?limit=abc',
                      '?limit=²', '?limit=1&limit=2', '?offset=99999999999'):
            self.assertEqual(self.get(query).status_code, 400, query)
