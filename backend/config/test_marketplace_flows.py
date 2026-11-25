"""Regression checks for the connected booking and management workflows."""

from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.test import Client, override_settings
from mongoengine.queryset import QuerySet

from config.models import AccountAccess, Event, PhysicalEvent, TicketPurchase, User
from config.tests import BaseMongoTestCase


class MarketplaceFlowTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        for model in (Event, TicketPurchase):
            model.drop_collection()
            self.addCleanup(model.drop_collection)
        self.enterContext(override_settings(ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="marketplace-flow-tests-signing-key-at-least-32-bytes"))
        self.client = Client(enforce_csrf_checks=True)
        self.organizer, self.buyer, self.admin, self.other = [self.user(role, name) for role, name in (
            ("organizer", "organizer"), ("attendee", "buyer"), ("admin", "admin"), ("organizer", "other"),
        )]
        self.event = PhysicalEvent(title="Community event", organizer_id=str(self.organizer.id),
            venue_name="Town Hall", address="Budapest", country="Hungary", continent="Europe",
            start_at=datetime.now(timezone.utc) + timedelta(days=1),
            end_at=datetime.now(timezone.utc) + timedelta(days=2),
            ticket_price_minor=1250, currency="EUR", available_tickets=5).save()

    def user(self, role, name):
        user = User(email=f"{name}@example.com", full_name=name.title(), role=role)
        user.set_password("test password 123!")
        return user.save()

    def auth(self, user, password="test password 123!"):
        response = self.client.post("/api/auth/login/", {"email": user.email, "password": password}, content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        return {"HTTP_AUTHORIZATION": f"Bearer {response.json()['token']}"}

    def request(self, method, path, data, user=None, headers=None):
        return getattr(self.client, method)(path, data, content_type="application/json", **(headers if headers is not None else self.auth(user or self.organizer)))

    def book(self, quantity=2):
        response = self.request("post", "/api/checkout/", {"event_id": str(self.event.id), "quantity": quantity}, self.buyer)
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def test_discovery_applies_combined_filters_and_pagination(self):
        Event(title="Other country", organizer_id="other", country="France", continent="Europe").save()
        self.assertEqual([e["id"] for e in self.client.get("/api/events/?country=hungary&continent=europe&type=physical").json()], [str(self.event.id)])
        self.assertEqual(self.client.get("/api/events/?type=online").json(), [])
        self.assertEqual(len(self.client.get("/api/events/?limit=1").json()), 1)
        self.assertEqual(len(self.client.get("/api/events/?limit=1&offset=1").json()), 1)
        for query in ("type=invalid", "country=A&country=B", "limit=0", "unknown=1"):
            self.assertEqual(self.client.get(f"/api/events/?{query}").status_code, 400)

    def test_booking_receipt_and_dashboard_share_the_same_purchase(self):
        purchase = self.book()
        history = self.client.get("/api/tickets/", **self.auth(self.buyer)).json()
        self.assertEqual(history["results"][0]["id"], purchase["id"])
        self.assertEqual(history["results"][0]["booking_mode"], "simulation")
        totals = self.client.get("/api/organizer/analytics/", **self.auth(self.organizer)).json()
        self.assertEqual((totals["purchase_count"], totals["tickets_sold"]), (1, 2))
        self.assertEqual(totals["revenue_by_currency"], [{"currency": "EUR", "total_amount_minor": "2500"}])
        self.assertEqual(self.client.get("/api/organizer/analytics/", **self.auth(self.other)).json()["tickets_sold"], 0)

    def test_unavailable_events_cannot_be_booked(self):
        for changes in ({"status": "draft"}, {"status": "cancelled"}, {"moderation_blocked": True},
                        {"end_at": datetime.now(timezone.utc) - timedelta(seconds=1)}):
            original = {key: getattr(self.event, key) for key in changes}
            self.event.update(**{f"set__{key}": value for key, value in changes.items()})
            response = self.request("post", "/api/checkout/", {"event_id": str(self.event.id), "quantity": 1}, self.buyer)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["code"], "event_unavailable")
            self.event.update(**{f"set__{key}": value for key, value in original.items()})
        self.assertEqual(self.event.reload().available_tickets, 5)
        self.assertEqual(TicketPurchase.objects.count(), 0)

    def test_stock_edits_reject_stale_forms_and_preserve_bookings(self):
        self.book()
        path = f"/api/events/{self.event.id}/"
        response = self.request("put", path, {"available_tickets": 10, "expected_available_tickets": 5})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.event.reload().available_tickets, 3)
        self.assertEqual(self.request("put", path, {"available_tickets": 10, "expected_available_tickets": 3}).status_code, 200)

    def test_cancellation_is_visible_and_cannot_be_reopened_or_deleted(self):
        self.book()
        path = f"/api/events/{self.event.id}/"
        self.assertEqual(self.request("put", path, {"status": "cancelled"}).status_code, 200)
        history = self.client.get("/api/tickets/", **self.auth(self.buyer)).json()
        self.assertEqual(history["results"][0]["event_status"], "cancelled")
        self.assertEqual(self.client.get("/api/events/").json(), [])
        self.assertEqual(self.request("put", path, {"status": "published"}).status_code, 400)
        self.assertEqual(self.request("delete", path, {}).status_code, 409)

    def test_only_drafts_without_bookings_can_be_deleted(self):
        path = f"/api/events/{self.event.id}/"
        self.assertEqual(self.request("delete", path, {}).status_code, 409)
        self.assertEqual(self.request("put", path, {"status": "draft"}).status_code, 200)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.request("delete", path, {}).status_code, 204)

    def test_check_in_enforces_owner_signature_quantity_and_remaining_admissions(self):
        purchase = self.book()
        payload = {"admission_code": purchase["admission_code"], "quantity": 1, "request_id": str(uuid4())}
        self.assertEqual(self.request("post", "/api/check-in/", payload, self.other).status_code, 404)
        self.assertEqual(self.request("post", "/api/check-in/", payload, self.buyer).status_code, 403)
        self.assertEqual(self.request("post", "/api/check-in/", {**payload, "admission_code": "forged"}).status_code, 400)
        for quantity in (True, 0, -1, "1", 1.5):
            self.assertEqual(self.request("post", "/api/check-in/", {**payload, "quantity": quantity}).status_code, 400)
        first = self.request("post", "/api/check-in/", payload)
        self.assertEqual(first.json()["checked_in"], 1)
        self.assertEqual(self.request("post", "/api/check-in/", payload).json()["checked_in"], 1)
        payload["request_id"] = str(uuid4())
        self.assertEqual(self.request("post", "/api/check-in/", payload).json()["checked_in"], 2)
        payload["request_id"] = str(uuid4())
        self.assertEqual(self.request("post", "/api/check-in/", payload).status_code, 409)

    def test_check_in_handles_legacy_counters_and_cancelled_events(self):
        purchase = self.book()
        TicketPurchase._get_collection().update_one({"_id": TicketPurchase.objects.first().id}, {"$unset": {"checked_in": ""}})
        payload = {"admission_code": purchase["admission_code"], "quantity": 1, "request_id": str(uuid4())}
        self.assertEqual(self.request("post", "/api/check-in/", payload).json()["checked_in"], 1)
        self.event.update(set__status="cancelled")
        self.assertEqual(self.request("post", "/api/check-in/", payload).status_code, 409)

    def test_competing_check_ins_cannot_admit_more_guests_than_booked(self):
        purchase = self.book()
        headers = self.auth(self.organizer)
        barrier = Barrier(2)
        original = QuerySet.modify

        def modify(query, *args, **kwargs):
            if query._document is TicketPurchase:
                barrier.wait(timeout=10)
            return original(query, *args, **kwargs)

        def admit(_):
            return Client().post("/api/check-in/", {"admission_code": purchase["admission_code"],
                "quantity": 2, "request_id": str(uuid4())}, content_type="application/json", **headers).status_code

        with patch.object(QuerySet, "modify", modify), ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(admit, range(2)))
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(TicketPurchase.objects.get(id=purchase["id"]).checked_in, 2)

    def test_profile_cannot_change_identity_or_role(self):
        self.assertEqual(self.request("put", "/api/account/", {"full_name": "New Name"}, self.buyer).status_code, 200)
        self.assertEqual(self.buyer.reload().full_name, "New Name")
        for data in ({"role": "admin"}, {"email": "new@example.com"}, {"full_name": " "}, {"password_hash": "raw"}):
            self.assertEqual(self.request("put", "/api/account/", data, self.buyer).status_code, 400)
        self.assertNotIn("password", str(self.client.get("/api/account/", **self.auth(self.buyer)).json()))

    def test_password_change_revokes_old_sessions_and_requires_current_password(self):
        headers = self.auth(self.buyer)
        data = {"current_password": "wrong", "new_password": "replacement password"}
        self.assertEqual(self.request("post", "/api/account/password/", data, headers=headers).status_code, 400)
        data["current_password"] = "test password 123!"
        self.assertEqual(self.request("post", "/api/account/password/", data, headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/api/tickets/", **headers).status_code, 403)
        self.assertEqual(self.client.get("/api/tickets/", **self.auth(self.buyer, "replacement password")).status_code, 200)

    def test_login_cannot_mint_a_new_session_from_a_concurrently_replaced_password(self):
        original = User.check_password

        def check_then_change(user, password):
            valid = original(user, password)
            changed = User.objects.get(id=user.id)
            changed.set_password("replacement password")
            changed.save()
            AccountAccess.objects(user_id=str(user.id)).update_one(inc__version=1, upsert=True)
            return valid

        with patch.object(User, "check_password", check_then_change):
            response = self.client.post("/api/auth/login/", {"email": self.buyer.email,
                "password": "test password 123!"}, content_type="application/json")
        self.assertEqual(response.status_code, 401)

    def test_suspension_revokes_tokens_hides_events_and_blocks_login(self):
        headers = self.auth(self.organizer)
        path = f"/api/admin/users/{str(self.organizer.id).upper()}/"
        self.assertEqual(self.request("put", path, {"active": False}, self.admin).status_code, 200)
        self.assertFalse(AccountAccess.objects.get(user_id=str(self.organizer.id)).active)
        self.assertEqual(self.client.get("/api/events/?mine=1", **headers).status_code, 403)
        self.assertEqual(self.client.get("/api/events/").json(), [])
        response = self.client.post("/api/auth/login/", {"email": self.organizer.email, "password": "test password 123!"}, content_type="application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.request("put", path, {"active": True}, self.admin).status_code, 200)
        self.assertEqual(self.client.get("/api/events/?mine=1", **headers).status_code, 403)
        self.assertEqual(self.client.get("/api/events/?mine=1", **self.auth(self.organizer)).status_code, 200)

    def test_admin_lists_and_moderation_are_role_scoped(self):
        for path in ("/api/admin/users/", "/api/admin/events/"):
            self.assertEqual(self.client.get(path, **self.auth(self.buyer)).status_code, 403)
            self.assertGreater(self.client.get(path, **self.auth(self.admin)).json()["count"], 0)
        path = f"/api/admin/events/{self.event.id}/"
        self.assertEqual(self.request("put", path, {"moderation_blocked": True}, self.admin).status_code, 200)
        self.assertEqual(self.client.get(f"/api/events/{self.event.id}/").status_code, 404)
        self.assertEqual(self.request("put", f"/api/events/{self.event.id}/", {"moderation_blocked": False}).status_code, 400)
        self.assertEqual(self.request("put", f"/api/admin/users/{self.admin.id}/", {"active": False}, self.admin).status_code, 409)

    def test_password_length_is_enforced_on_the_server(self):
        for password in ("short", "x" * 129):
            response = self.client.post("/api/auth/register/", {"email": "new@example.com", "password": password, "full_name": "New", "role": "attendee"}, content_type="application/json")
            self.assertEqual(response.status_code, 400)
