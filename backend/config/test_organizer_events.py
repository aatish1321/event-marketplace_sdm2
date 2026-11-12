"""Dashboard additions preserve the public polymorphic event API."""

import time

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import Event, OnlineEvent, PhysicalEvent
from config.tests import BaseMongoTestCase


class OrganizerEventTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        self.addCleanup(Event.drop_collection)
        self.enterContext(override_settings(
            ALLOWED_HOSTS=['testserver'],
            SECRET_KEY='event-tests-only-signing-key-at-least-32-bytes',
        ))
        self.client = Client(enforce_csrf_checks=True)
        self.payload = {
            'title': 'Community meetup', 'description': 'Meet the community',
            'start_at': '2030-04-10T12:00:00+02:00',
            'end_at': '2030-04-10T14:00:00+02:00',
            'event_type': 'physical', 'venue_name': 'Town Hall', 'address': '1 Main Street',
        }

    def auth(self, user_id='organizer-owner', role='organizer', **claims):
        payload = {'user_id': user_id, 'role': role,
                   'iat': int(time.time()) - 1, 'exp': int(time.time()) + 3600, **claims}
        return {'HTTP_AUTHORIZATION': f'Bearer {jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")}'}

    def post(self, data=None, user_id='organizer-owner'):
        return self.client.post('/api/events/', self.payload if data is None else data,
                                content_type='application/json', **self.auth(user_id))

    def test_create_physical_persists_canonical_subtype_and_normalizes_dates(self):
        response = self.post({**self.payload, 'organizer_id': 'spoofed-owner'})
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['organizer_id'], 'organizer-owner')
        self.assertEqual(data['venue_name'], 'Town Hall')
        self.assertEqual(data['address'], '1 Main Street')
        self.assertNotIn('stream_url', data)
        self.assertIn('created_at', data)
        event = Event.objects.get(id=data['id'])
        self.assertIsInstance(event, PhysicalEvent)
        self.assertEqual(event.start_at.hour, 10)
        self.assertEqual(event.description, self.payload['description'])

    def test_create_online_uses_stream_url_and_optional_description(self):
        payload = {key: value for key, value in self.payload.items()
                   if key not in ('venue_name', 'address', 'description')}
        payload.update(event_type='online', stream_url='https://events.example.com/room')
        response = self.post(payload)
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertNotIn('venue_name', data)
        self.assertNotIn('address', data)
        self.assertEqual(data['description'], '')
        self.assertEqual(data['stream_url'], payload['stream_url'])
        self.assertIsInstance(Event.objects.get(id=data['id']), OnlineEvent)

    def test_mine_is_private_scoped_uncached_and_public_list_stays_public(self):
        self.assertEqual(self.client.get('/api/events/?mine=1', **self.auth()).json(), [])
        mine = self.post().json()
        self.post({**self.payload, 'title': 'Other event'}, 'other-organizer')
        response = self.client.get('/api/events/?mine=1&organizer_id=other-organizer', **self.auth())
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response.headers['Cache-Control'])
        self.assertEqual([event['id'] for event in response.json()], [mine['id']])
        public = self.client.get('/api/events/')
        self.assertEqual(public.status_code, 200)
        self.assertEqual(len(public.json()), 2)

    def test_legacy_create_without_dates_still_works_with_stateless_identity(self):
        response = self.post({'title': 'Legacy event'})
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['event_type'], 'event')
        self.assertIsNone(data['start_at'])
        self.assertIsNone(data['end_at'])
        listing = self.client.get('/api/events/?mine=1', **self.auth()).json()
        self.assertEqual(listing[0]['id'], data['id'])

    def test_mine_rejects_missing_expired_invalid_and_non_organizer_credentials(self):
        for headers in ({}, {'HTTP_AUTHORIZATION': 'Bearer invalid'}, self.auth(exp=1),
                        self.auth(role='attendee'), self.auth(role='admin')):
            with self.subTest(headers=headers):
                self.assertEqual(self.client.get('/api/events/?mine=1', **headers).status_code, 403)

    def test_date_pairs_require_timezone_and_chronological_order(self):
        changes = [
            {'start_at': 'invalid'}, {'start_at': '2030-04-10T10:00:00'},
            {'end_at': '2030-04-10T09:00:00Z'}, {'end_at': '2030-04-10T10:00:00Z'},
            {'start_at': None}, {'end_at': 12}, {'description': 'x' * 5001},
        ]
        for change in changes:
            with self.subTest(change=change):
                response = self.post({**self.payload, **change})
                self.assertEqual(response.status_code, 400, response.content)
        for omitted in ('start_at', 'end_at'):
            payload = {key: value for key, value in self.payload.items() if key != omitted}
            self.assertEqual(self.post(payload).status_code, 400)
        self.assertEqual(Event.objects.count(), 0)

    def test_updates_validate_dates_against_unchanged_existing_date(self):
        created = self.post().json()
        response = self.client.put(f"/api/events/{created['id']}/", {'end_at': '2030-04-10T09:00:00Z'},
                                   content_type='application/json', **self.auth())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Event.objects.get(id=created['id']).end_at.hour, 12)
        response = self.client.put(f"/api/events/{created['id']}/", {'description': 'Updated'},
                                   content_type='application/json', **self.auth())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['description'], 'Updated')

    def test_created_timestamp_cannot_be_supplied_by_client(self):
        response = self.post({**self.payload, 'created_at': '2000-01-01T00:00:00Z'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Event.objects.count(), 0)
