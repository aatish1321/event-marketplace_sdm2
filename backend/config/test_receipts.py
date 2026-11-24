"""Private receipt and revenue endpoints, exercised with persisted test data."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import jwt
from bson import ObjectId
from django.conf import settings
from django.test import Client, override_settings
from mongoengine.errors import ValidationError

from config.tests import BaseMongoTestCase
from config.models import Event, OnlineEvent, PhysicalEvent, Ticket


class ReceiptFixtures:
    def auth(self, user_id="buyer", role="attendee", **changes):
        now = datetime.now(timezone.utc)
        token = jwt.encode({"user_id": user_id, "role": role, "iat": now,
                            "exp": now + timedelta(hours=1), **changes},
                           settings.SECRET_KEY, algorithm="HS256")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def event(self, owner="organizer", model=Event, **changes):
        fields = {"title": "Original Event", "organizer_id": owner, **changes}
        if model is PhysicalEvent:
            fields.update(venue_name="Hall", address="Street")
        elif model is OnlineEvent:
            fields["stream_url"] = "https://example.com/live"
        return model(**fields).save()

    def ticket(self, event=None, **changes):
        event = event or self.event()
        return Ticket(**{"user_id": "buyer", "event_id": event.id,
                         "event_title": event.title, "quantity": 1,
                         "total_paid": Decimal("12.50"), "currency": "EUR",
                         "status": "paid", **changes}).save()

    def revenue(self, user_id="organizer"):
        response = self.client.get("/api/organizer/analytics/", **self.auth(user_id, "organizer"))
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["revenue"]


class ReceiptApiTests(ReceiptFixtures, BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        Ticket.drop_collection()
        self.enterContext(override_settings(ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="receipt-tests-only-signing-secret-at-least-32-bytes"))
        self.client = Client(enforce_csrf_checks=True)

    def tearDown(self):
        Ticket.drop_collection()
        Event.drop_collection()
        super().tearDown()

    def test_receipts_are_scoped_to_verified_identity_for_each_role(self):
        own = self.ticket()
        self.ticket(user_id="someone-else")
        for role in ("attendee", "organizer", "admin"):
            with self.subTest(role=role):
                response = self.client.get("/api/user/tickets/", **self.auth(role=role))
                self.assertEqual(response.status_code, 200)
                self.assertEqual([item["id"] for item in response.json()["tickets"]], [str(own.id)])
                self.assertIn("private", response["Cache-Control"])
                self.assertIn("no-store", response["Cache-Control"])

    def test_receipt_snapshot_survives_event_changes_and_deletion(self):
        event = self.event()
        ticket = self.ticket(event, quantity=3)
        event.update(set__title="Renamed Event")
        event.delete()
        response = self.client.get("/api/user/tickets/", **self.auth())
        item = response.json()["tickets"][0]
        self.assertEqual(set(item), {"id", "event_id", "event_title", "quantity",
                                   "total_paid", "currency", "status", "created_at"})
        self.assertEqual(item["id"], str(ticket.id))
        self.assertEqual(item["event_id"], str(event.id))
        self.assertEqual(item["event_title"], "Original Event")
        self.assertEqual(item["total_paid"], "12.50")
        self.assertEqual(item["quantity"], 3)
        self.assertEqual(datetime.fromisoformat(item["created_at"]).utcoffset(), timedelta(0))

    def test_pagination_is_stable_newest_first_and_reports_more(self):
        event = self.event()
        when = datetime(2026, 1, 1, tzinfo=timezone.utc)
        tickets = [self.ticket(event, created_at=when, id=ObjectId(f"{n:024x}")) for n in (1, 2, 3)]
        response = self.client.get("/api/user/tickets/", {"limit": 1, "offset": 1}, **self.auth())
        body = response.json()
        self.assertEqual(body["tickets"][0]["id"], str(tickets[1].id))
        self.assertEqual((body["limit"], body["offset"], body["has_more"]), (1, 1, True))
        last = self.client.get("/api/user/tickets/", {"limit": 1, "offset": 2}, **self.auth()).json()
        self.assertEqual(last["tickets"][0]["id"], str(tickets[0].id))
        self.assertFalse(last["has_more"])
        empty = self.client.get("/api/user/tickets/", {"offset": 100000}, **self.auth()).json()
        self.assertEqual(empty["tickets"], [])
        self.assertFalse(empty["has_more"])

    def test_empty_receipts_and_all_statuses_are_supported(self):
        body = self.client.get("/api/user/tickets/", **self.auth()).json()
        self.assertEqual(body, {"tickets": [], "limit": 20, "offset": 0, "has_more": False})
        event = self.event()
        for status in ("pending", "paid", "refunded", "cancelled"):
            self.ticket(event, status=status)
        body = self.client.get("/api/user/tickets/", **self.auth()).json()
        self.assertEqual({item["status"] for item in body["tickets"]}, {"pending", "paid", "refunded", "cancelled"})

    def test_parameters_cannot_override_ownership_and_are_validated(self):
        cases = [{"user_id": "victim"}, {"limit": "0"}, {"limit": "101"}, {"limit": "1.5"},
                 {"limit": "nan"}, {"offset": "-1"}, {"offset": "100001"}, {"offset": "1.0"},
                 {"offset": ""}, {"limit": ["1", "2"]}, {"offset": ["0", "1"]}]
        for query in cases:
            with self.subTest(query=query):
                self.assertEqual(self.client.get("/api/user/tickets/", query, **self.auth()).status_code, 400)
        for query in ({"organizer_id": "victim"}, {"user_id": "victim"}, {"currency": "EUR"}):
            self.assertEqual(self.client.get("/api/organizer/analytics/", query,
                             **self.auth("organizer", "organizer")).status_code, 400)

    def test_authentication_roles_and_read_only_methods(self):
        for path in ("/api/user/tickets/", "/api/organizer/analytics/"):
            for headers in ({}, {"HTTP_AUTHORIZATION": "Bearer invalid"},
                            self.auth(exp=datetime.now(timezone.utc) - timedelta(seconds=1))):
                with self.subTest(path=path, headers=headers):
                    self.assertEqual(self.client.get(path, **headers).status_code, 403)
            for method in ("post", "put", "patch", "delete", "head", "options"):
                with self.subTest(path=path, method=method):
                    self.assertEqual(getattr(self.client, method)(path,
                        **self.auth("organizer", "organizer")).status_code, 405)
        for role in ("attendee", "admin"):
            self.assertEqual(self.client.get("/api/organizer/analytics/", **self.auth(role=role)).status_code, 403)

    def test_revenue_uses_paid_totals_once_and_separates_currencies_and_owners(self):
        physical = self.event(model=PhysicalEvent)
        online = self.event(model=OnlineEvent)
        self.ticket(physical, total_paid=Decimal("0.10"), quantity=3)
        self.ticket(online, total_paid=Decimal("0.20"), quantity=2)
        self.ticket(online, total_paid=Decimal("7.00"), currency="USD")
        for status in ("pending", "refunded", "cancelled"):
            self.ticket(physical, total_paid=Decimal("999"), status=status)
        self.ticket(self.event(owner="other"), total_paid=Decimal("888"))
        response = self.client.get("/api/organizer/analytics/", **self.auth("organizer", "organizer"))
        self.assertEqual(response.json(), {"revenue": [
            {"currency": "EUR", "total_revenue": "0.30", "tickets_sold": 5, "receipt_count": 2},
            {"currency": "USD", "total_revenue": "7.00", "tickets_sold": 1, "receipt_count": 1},
        ]})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("private", response["Cache-Control"])

    def test_current_event_ownership_and_deleted_events_control_analytics(self):
        self.assertEqual(self.revenue(), [])
        event = self.event()
        self.ticket(event)
        event.update(set__organizer_id="new-owner")
        self.assertEqual(self.revenue(), [])
        self.assertEqual(self.revenue("new-owner")[0]["total_revenue"], "12.50")
        event.delete()
        self.assertEqual(self.revenue("new-owner"), [])

    def test_paid_free_receipts_count_tickets_without_adding_revenue(self):
        self.ticket(quantity=4, total_paid=Decimal("0.00"))
        self.assertEqual(self.revenue(), [
            {"currency": "EUR", "total_revenue": "0.00", "tickets_sold": 4, "receipt_count": 1},
        ])

    def test_model_defaults_and_invalid_values(self):
        event = self.event()
        fields = dict(user_id="buyer", event_id=event.id, event_title="Snapshot",
                      total_paid=Decimal("0.00"), currency="EUR")
        ticket = Ticket(**fields).save()
        self.assertEqual(ticket.status, "pending")
        self.assertEqual(ticket.quantity, 1)
        self.assertIsNotNone(ticket.created_at)
        for changes in ({"quantity": None}, {"quantity": 0}, {"quantity": -1}, {"total_paid": Decimal("-1")},
                        {"total_paid": Decimal("NaN")}, {"total_paid": Decimal("Infinity")},
                        {"currency": "eur"}, {"currency": "EURO"}, {"status": "unknown"},
                        {"user_id": " "}, {"event_title": " "}, {"event_id": None}):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                Ticket(**{**fields, **changes}).validate()
