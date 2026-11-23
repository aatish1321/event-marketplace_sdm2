"""Exact server-authoritative pricing and immutable booked amounts."""

import time
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import Event, TicketPurchase, User
from config.tests import BaseMongoTestCase


class PricingTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        TicketPurchase.drop_collection()
        self.addCleanup(Event.drop_collection)
        self.addCleanup(TicketPurchase.drop_collection)
        self.enterContext(override_settings(ALLOWED_HOSTS=['testserver'],
            SECRET_KEY='pricing-tests-only-signing-key-at-least-32-bytes'))
        self.client = Client(enforce_csrf_checks=True)
        self.buyer = User(email='buyer@example.com', full_name='Buyer', role='attendee').save()
        self.event = Event(title='Priced event', organizer_id='organizer', available_tickets=10,
                           ticket_price_minor=1250, currency='EUR').save()

    def auth(self, role='attendee'):
        payload = {'user_id': str(self.buyer.id) if role == 'attendee' else 'organizer', 'role': role,
                   'iat': int(time.time()) - 1, 'exp': int(time.time()) + 3600}
        return {'HTTP_AUTHORIZATION': f'Bearer {jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")}'}

    def checkout(self, **changes):
        return self.client.post('/api/checkout/', {'event_id': str(self.event.id), 'quantity': 2, **changes},
                                content_type='application/json', **self.auth())

    def test_server_calculates_and_keeps_historical_amounts_after_event_change_and_deletion(self):
        response = self.checkout(expected_unit_price_minor=1250, expected_currency='EUR')
        self.assertEqual(response.status_code, 201, response.content)
        for key, value in {'unit_price_minor': 1250, 'total_amount_minor': 2500, 'currency': 'EUR'}.items():
            self.assertEqual(response.json()[key], value)
        self.event.update(set__ticket_price_minor=9900, set__currency='USD')
        self.event.delete()
        receipt = self.client.get('/api/tickets/', **self.auth()).json()['results'][0]
        self.assertEqual(receipt['total_amount_minor'], 2500)
        self.assertEqual(receipt['currency'], 'EUR')

    def test_free_is_zero_and_legacy_unpriced_is_null(self):
        self.event.update(set__ticket_price_minor=0)
        response = self.checkout()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['total_amount_minor'], 0)
        legacy = Event(title='Legacy', organizer_id='organizer', available_tickets=2).save()
        response = self.checkout(event_id=str(legacy.id))
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()['total_amount_minor'])
        self.assertIsNone(response.json()['currency'])

    def test_stale_price_or_currency_returns_conflict_without_reserving_inventory(self):
        for changes in ({'expected_unit_price_minor': 1, 'expected_currency': 'EUR'},
                        {'expected_unit_price_minor': 1250, 'expected_currency': 'USD'}):
            response = self.checkout(**changes)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()['code'], 'price_changed')
        self.assertEqual(self.event.reload().available_tickets, 10)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_forged_totals_and_incomplete_expected_price_are_rejected(self):
        for changes in ({'total_amount_minor': 1}, {'unit_price_minor': 1}, {'currency': 'USD'},
                        {'expected_unit_price_minor': 1250}, {'expected_currency': 'EUR'}):
            response = self.checkout(**changes)
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.event.reload().available_tickets, 10)

    def test_unpriced_expectation_detects_new_price_and_invalid_pairs_are_rejected(self):
        response = self.checkout(expected_unit_price_minor=None, expected_currency=None)
        self.assertEqual(response.status_code, 409)
        for price, currency in ((True, 'EUR'), (1.5, 'EUR'), (0, None), (None, 'EUR'), (1, [])):
            response = self.checkout(expected_unit_price_minor=price, expected_currency=currency)
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.event.reload().available_tickets, 10)

    def test_invalid_price_update_leaves_stored_event_unchanged(self):
        response = self.client.put(f'/api/events/{self.event.id}/',
            {'ticket_price_minor': -1}, content_type='application/json', **self.auth('organizer'))
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.event.reload().ticket_price_minor, 1250)

    def test_product_overflow_does_not_decrement_inventory(self):
        self.event.update(set__ticket_price_minor=9007199254740991)
        response = self.checkout()
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.event.reload().available_tickets, 10)

    def test_price_changed_between_read_and_reservation_cannot_charge_stale_amount(self):
        from config.checkout_views import _find_event
        def concurrent_price_change(event_id):
            event = _find_event(event_id)
            Event.objects(id=event.id).update_one(set__ticket_price_minor=1300)
            return event
        with patch('config.checkout_views._find_event', side_effect=concurrent_price_change):
            response = self.checkout(expected_unit_price_minor=1250, expected_currency='EUR')
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(self.event.reload().available_tickets, 10)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_event_prices_require_valid_integer_and_currency_pair(self):
        invalid = [{'ticket_price_minor': value, 'currency': 'EUR'} for value in (-1, 1.5, True, '1250', 9007199254740992)]
        invalid += [{'ticket_price_minor': 100}, {'currency': 'EUR'},
                    {'ticket_price_minor': 100, 'currency': 'XYZ'}]
        for changes in invalid:
            response = self.client.post('/api/events/', {'title': 'Bad price', **changes},
                                       content_type='application/json', **self.auth('organizer'))
            self.assertEqual(response.status_code, 400, (changes, response.content))
