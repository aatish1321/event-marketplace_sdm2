"""Checkout persistence, validation, and competing inventory regressions."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import Client, override_settings
from mongoengine.errors import OperationError, ValidationError
from mongoengine.queryset import QuerySet

from config.models import BuyerSnapshot, Event, EventSnapshot, OnlineEvent, PhysicalEvent, TicketPurchase, User
from config.tests import BaseMongoTestCase


class CheckoutTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        TicketPurchase.drop_collection()
        self.enterContext(override_settings(
            ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="checkout-tests-only-signing-key-at-least-32-bytes",
        ))
        self.client = Client(enforce_csrf_checks=True)
        self.buyer = User(email="buyer@example.com", full_name="Ticket Buyer", role="attendee").save()
        self.event = Event(title="Conference", organizer_id="owner", available_tickets=5).save()

    def tearDown(self):
        Event.drop_collection()
        TicketPurchase.drop_collection()
        super().tearDown()

    def authorization(self, user_id=None, role="attendee", **claims):
        now = datetime.now(timezone.utc)
        token = jwt.encode({
            "user_id": user_id or str(self.buyer.id), "role": role,
            "iat": now, "exp": now + timedelta(hours=1), **claims,
        }, settings.SECRET_KEY, algorithm="HS256")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def checkout(self, data=None, authorization=None, client=None):
        return (client or self.client).post(
            "/api/checkout/", data if data is not None else {"event_id": str(self.event.id), "quantity": 2},
            content_type="application/json",
            **(authorization if authorization is not None else self.authorization()),
        )

    def test_purchase_decrements_inventory_and_embeds_safe_snapshots(self):
        self.buyer.update(set__password_hash="must-not-be-copied")
        response = self.checkout()
        self.assertEqual(response.status_code, 201, response.content)
        purchase = TicketPurchase.objects.get(id=response.json()["id"])
        self.assertEqual(self.event.reload().available_tickets, 3)
        self.assertEqual(purchase.quantity, 2)
        self.assertIsNotNone(purchase.created_at)
        self.assertIsInstance(purchase.buyer_snapshot, BuyerSnapshot)
        self.assertIsInstance(purchase.event_snapshot, EventSnapshot)
        self.assertEqual(purchase.buyer_snapshot.user_id, str(self.buyer.id))
        self.assertEqual(purchase.buyer_snapshot.email, self.buyer.email)
        self.assertEqual(purchase.buyer_snapshot.full_name, self.buyer.full_name)
        self.assertEqual(purchase.event_snapshot.event_id, str(self.event.id))
        self.assertEqual(purchase.event_snapshot.title, self.event.title)
        self.assertEqual(purchase.event_snapshot.organizer_id, self.event.organizer_id)
        self.assertEqual(purchase.event_snapshot.event_type, "event")
        self.assertEqual(response.json()["quantity"], 2)
        self.assertEqual(response.json()["buyer_snapshot"]["email"], self.buyer.email)
        self.assertEqual(response.json()["event_snapshot"]["title"], self.event.title)
        self.assertNotIn("password", str(response.json()))
        self.assertNotIn("password", str(purchase.to_mongo()))
        original = purchase.to_mongo().to_dict()
        self.buyer.update(set__full_name="Changed", set__email="changed@example.com")
        self.event.update(set__title="Changed")
        self.buyer.delete()
        self.event.delete()
        self.assertEqual(purchase.reload().to_mongo().to_dict(), original)

    def test_subtype_and_schedule_snapshots(self):
        start = datetime(2027, 1, 1, 12)
        end = start + timedelta(hours=2)
        for model, event_type, fields in (
            (PhysicalEvent, "physical", {"venue_name": "Hall", "address": "1 Main Street"}),
            (OnlineEvent, "online", {"stream_url": "https://example.com/live"}),
        ):
            with self.subTest(event_type=event_type):
                event = model(title="Subtype", organizer_id="owner", available_tickets=1,
                              start_at=start, end_at=end, **fields).save()
                response = self.checkout({"event_id": str(event.id), "quantity": 1})
                self.assertEqual(response.status_code, 201, response.content)
                snapshot = TicketPurchase.objects.get(id=response.json()["id"]).event_snapshot
                self.assertEqual(snapshot.event_type, event_type)
                self.assertEqual(snapshot.start_at, start)
                self.assertEqual(snapshot.end_at, end)
                for field, value in fields.items():
                    self.assertEqual(getattr(snapshot, field), value)

    def test_invalid_payloads_never_change_inventory(self):
        valid = {"event_id": str(self.event.id), "quantity": 1}
        invalid = [{}, {"event_id": str(self.event.id)}, {"quantity": 1}]
        invalid += [{**valid, "quantity": value} for value in (0, -1, True, False, 1.0, "1", None, [], {}, 2**63)]
        invalid += [{**valid, "event_id": value} for value in (None, True, 42, [], {}, "", " ")]
        invalid += [{**valid, field: "spoofed"} for field in ("user_id", "buyer_snapshot", "unknown")]
        for data in invalid:
            with self.subTest(data=data):
                self.assertEqual(self.checkout(data).status_code, 400)
        for body in (b"", b"{", b"null", b"[]", b"true", b"42", b'{"event_id":"\xff"}', b"[" * 2000):
            with self.subTest(body=body[:30]):
                self.assertEqual(self.checkout(body).status_code, 400)
        self.assertEqual(self.event.reload().available_tickets, 5)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_missing_or_malformed_event_is_not_found(self):
        for event_id in ("invalid-id", "012345678901234567890123"):
            with self.subTest(event_id=event_id):
                self.assertEqual(self.checkout({"event_id": event_id, "quantity": 1}).status_code, 404)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_authentication_and_current_attendee_account_are_required(self):
        headers = [{}, {"HTTP_AUTHORIZATION": "Bearer invalid"}, self.authorization(role="organizer"),
                   self.authorization(role="admin"), self.authorization(user_id="invalid-id"),
                   self.authorization(user_id="012345678901234567890123"),
                   self.authorization(exp=datetime.now(timezone.utc) - timedelta(seconds=1))]
        for authorization in headers:
            with self.subTest(authorization=authorization):
                self.assertEqual(self.checkout(authorization=authorization).status_code, 403)
        self.buyer.update(set__role="organizer")
        self.assertEqual(self.checkout().status_code, 403)
        self.buyer.delete()
        self.assertEqual(self.checkout().status_code, 403)
        self.assertEqual(self.event.reload().available_tickets, 5)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_only_post_is_allowed(self):
        for method in ("get", "put", "patch", "delete", "head", "options"):
            with self.subTest(method=method):
                response = getattr(self.client, method)("/api/checkout/", **self.authorization())
                self.assertEqual(response.status_code, 405)
                self.assertEqual(response["Allow"], "POST")

    def test_insufficient_stock_and_sold_out_do_not_create_purchase(self):
        self.assertEqual(self.checkout({"event_id": str(self.event.id), "quantity": 6}).status_code, 409)
        self.assertEqual(self.event.reload().available_tickets, 5)
        self.assertEqual(self.checkout({"event_id": str(self.event.id), "quantity": 5}).status_code, 201)
        self.assertEqual(self.event.reload().available_tickets, 0)
        self.assertEqual(self.checkout().status_code, 409)
        self.assertEqual(TicketPurchase.objects.count(), 1)

    def test_largest_bson_quantity(self):
        self.event.update(set__available_tickets=2**63 - 1)
        response = self.checkout({"event_id": str(self.event.id), "quantity": 2**63 - 1})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self.event.reload().available_tickets, 0)

    def test_event_save_rejects_negative_inventory_while_atomic_decrement_works(self):
        with self.assertRaises(ValidationError):
            Event(title="Invalid inventory", organizer_id="owner", available_tickets=-1).save()
        self.assertEqual(Event.objects.count(), 1)
        self.assertEqual(Event.objects(id=self.event.id, available_tickets__gte=2).update_one(
            dec__available_tickets=2,
        ), 1)
        self.assertEqual(self.event.reload().available_tickets, 3)

    def test_schema_rejects_missing_snapshots_and_invalid_quantity(self):
        self.assertEqual(self.checkout().status_code, 201)
        purchase = TicketPurchase.objects.first()
        for changes in ({"buyer_snapshot": None}, {"event_snapshot": None}, {"quantity": 0}, {"quantity": 2**63}):
            with self.subTest(changes=changes):
                invalid = TicketPurchase(buyer_snapshot=purchase.buyer_snapshot,
                                         event_snapshot=purchase.event_snapshot, quantity=1)
                for field, value in changes.items():
                    setattr(invalid, field, value)
                with self.assertRaises(ValidationError):
                    invalid.validate()

    def test_purchase_save_failure_keeps_inventory_reserved(self):
        with patch.object(TicketPurchase, "save", side_effect=OperationError("Insert failed")):
            with self.assertRaises(OperationError):
                self.checkout()
        self.assertEqual(self.event.reload().available_tickets, 3)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_ambiguous_save_failure_cannot_restore_already_purchased_inventory(self):
        original_save = TicketPurchase.save

        def save_then_raise(purchase, *args, **kwargs):
            original_save(purchase, *args, **kwargs)
            raise OperationError("Acknowledgement lost after insert")

        with patch.object(TicketPurchase, "save", save_then_raise):
            with self.assertRaises(OperationError):
                self.checkout()
        self.assertEqual(self.event.reload().available_tickets, 3)
        self.assertEqual(TicketPurchase.objects.count(), 1)
        self.assertEqual(TicketPurchase.objects.first().quantity, 2)

    def test_competing_checkouts_do_not_oversell(self):
        self.event.update(set__available_tickets=3)
        barrier = Barrier(8)
        original_update = QuerySet.update_one

        def synchronized_update(queryset, **updates):
            if queryset._document is Event and "dec__available_tickets" in updates:
                barrier.wait(timeout=10)
            return original_update(queryset, **updates)

        def buy(_):
            return self.checkout({"event_id": str(self.event.id), "quantity": 1}, client=Client()).status_code

        # Synchronize immediately before the write so every request has read the same stock.
        with patch.object(QuerySet, "update_one", synchronized_update):
            with ThreadPoolExecutor(max_workers=8) as executor:
                statuses = list(executor.map(buy, range(8)))
        self.assertEqual(statuses.count(201), 3, statuses)
        self.assertEqual(statuses.count(409), 5, statuses)
        self.assertEqual(self.event.reload().available_tickets, 0)
        self.assertEqual(TicketPurchase.objects.count(), 3)
        self.assertEqual(sum(p.quantity for p in TicketPurchase.objects), 3)
