"""Role-scoped historical receipts and organizer analytics."""

import datetime
import time

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import BuyerSnapshot, EventSnapshot, TicketPurchase
from config.tests import BaseMongoTestCase


class AccountViewsTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        TicketPurchase.drop_collection()
        self.addCleanup(TicketPurchase.drop_collection)
        self.enterContext(override_settings(ALLOWED_HOSTS=['testserver'],
            SECRET_KEY='account-tests-only-signing-key-at-least-32-bytes'))
        self.client = Client()

    def auth(self, role, user_id='owner', **claims):
        payload = {'user_id': user_id, 'role': role, 'iat': int(time.time()) - 1,
                   'exp': int(time.time()) + 3600, **claims}
        return {'HTTP_AUTHORIZATION': f'Bearer {jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")}'}

    def purchase(self, buyer='owner', organizer='organizer', event='deleted-event', quantity=2, minute=0):
        return TicketPurchase(
            buyer_snapshot=BuyerSnapshot(user_id=buyer, email=f'{buyer}@example.com', full_name='Original buyer'),
            event_snapshot=EventSnapshot(event_id=event, title='Original event', organizer_id=organizer,
                event_type='physical', venue_name='Original hall', address='Original address'),
            quantity=quantity, created_at=datetime.datetime(2030, 1, 1, 0, minute),
        ).save()

    def test_receipts_return_only_buyer_snapshots_in_newest_first_pages(self):
        first = self.purchase(minute=1)
        latest = self.purchase(minute=2)
        self.purchase(buyer='other', minute=3)
        response = self.client.get('/api/tickets/?limit=1&offset=0&user_id=other', **self.auth('attendee'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        data = response.json()
        self.assertEqual((data['count'], data['limit'], data['offset']), (2, 1, 0))
        self.assertEqual(data['results'][0]['id'], str(latest.id))
        self.assertEqual(data['results'][0]['buyer_snapshot']['email'], 'owner@example.com')
        self.assertEqual(data['results'][0]['event_snapshot']['title'], 'Original event')
        self.assertEqual(data['results'][0]['event_snapshot']['venue_name'], 'Original hall')
        second = self.client.get('/api/tickets/?limit=1&offset=1', **self.auth('attendee')).json()
        self.assertEqual(second['results'][0]['id'], str(first.id))

    def test_receipts_empty_past_end_and_invalid_pagination(self):
        self.assertEqual(self.client.get('/api/tickets/', **self.auth('attendee')).json(),
                         {'count': 0, 'limit': 20, 'offset': 0, 'results': []})
        self.purchase()
        self.assertEqual(self.client.get('/api/tickets/?offset=10', **self.auth('attendee')).json()['results'], [])
        for query in ('limit=0', 'limit=101', 'offset=-1', 'limit=abc', 'limit=1&limit=2', 'offset=2147483648'):
            self.assertEqual(self.client.get(f'/api/tickets/?{query}', **self.auth('attendee')).status_code, 400)

    def test_event_filter_finds_old_receipts_without_exposing_other_buyers(self):
        event_id = '0123456789abcdef01234567'
        own = self.purchase(event=event_id)
        self.purchase(buyer='other', event=event_id, minute=2)
        for minute in range(1, 22):
            self.purchase(event='another-event', minute=minute)
        response = self.client.get(f'/api/tickets/?event_id={event_id.upper()}&limit=1', **self.auth('attendee'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)
        self.assertEqual([record['id'] for record in response.json()['results']], [str(own.id)])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(self.client.get('/api/tickets/?event_id=ffffffffffffffffffffffff', **self.auth('attendee')).json()['count'], 0)

    def test_event_filter_rejects_invalid_and_repeated_ids(self):
        for query in ('event_id=', 'event_id=invalid', 'event_id=0123456789abcdef01234567&event_id=ffffffffffffffffffffffff'):
            self.assertEqual(self.client.get(f'/api/tickets/?{query}', **self.auth('attendee')).status_code, 400)

    def test_roles_missing_and_expired_tokens_cannot_read_private_data(self):
        for path, permitted in (('/api/tickets/', 'attendee'), ('/api/organizer/analytics/', 'organizer')):
            for headers in ({}, {'HTTP_AUTHORIZATION': 'Bearer bad'}, self.auth(permitted, exp=1)):
                response = self.client.get(path, **headers)
                self.assertEqual(response.status_code, 403)
                self.assertIn('no-store', response['Cache-Control'])
            for role in {'attendee', 'organizer', 'admin'} - {permitted}:
                self.assertEqual(self.client.get(path, **self.auth(role)).status_code, 403)
            self.assertEqual(self.client.post(path, **self.auth(permitted)).status_code, 405)

    def test_analytics_aggregate_owned_historical_events_without_buyer_details(self):
        self.purchase(organizer='owner', event='deleted-event', quantity=2)
        self.purchase(buyer='other', organizer='owner', event='deleted-event', quantity=3)
        self.purchase(organizer='owner', event='another-event', quantity=4)
        self.purchase(organizer='other', quantity=99)
        response = self.client.get('/api/organizer/analytics/?organizer_id=other', **self.auth('organizer'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(response.json(), {
            'purchase_count': 3, 'tickets_sold': 9, 'events_with_sales': 2,
            'unpriced_purchase_count': 3, 'revenue_by_currency': [],
        })

    def test_zero_sales_do_not_invent_revenue(self):
        response = self.client.get('/api/organizer/analytics/', **self.auth('organizer'))
        self.assertEqual(response.json(), {'purchase_count': 0, 'tickets_sold': 0, 'events_with_sales': 0,
            'unpriced_purchase_count': 0, 'revenue_by_currency': []})

    def test_revenue_is_exact_and_separate_for_each_currency(self):
        for currency, amount in [('EUR', 1200), ('EUR', 300), ('USD', 900), ('HUF', 0)]:
            purchase = self.purchase(organizer='owner', quantity=1)
            purchase.update(set__unit_price_minor=amount, set__total_amount_minor=amount, set__currency=currency)
        self.purchase(organizer='owner')
        data = self.client.get('/api/organizer/analytics/', **self.auth('organizer')).json()
        self.assertEqual(data['unpriced_purchase_count'], 1)
        self.assertEqual({row['currency']: row['total_amount_minor'] for row in data['revenue_by_currency']},
                         {'EUR': '1500', 'USD': '900', 'HUF': '0'})

    def test_revenue_preserves_totals_larger_than_javascript_safe_integer(self):
        for _ in range(2):
            purchase = self.purchase(organizer='owner', quantity=1)
            purchase.update(set__unit_price_minor=9007199254740991,
                            set__total_amount_minor=9007199254740991, set__currency='EUR')
        data = self.client.get('/api/organizer/analytics/', **self.auth('organizer')).json()
        self.assertEqual(data['revenue_by_currency'], [
            {'currency': 'EUR', 'total_amount_minor': '18014398509481982'}])
