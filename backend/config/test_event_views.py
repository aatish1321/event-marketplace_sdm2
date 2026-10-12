"""Event API authorization and persistence regressions using mongomock."""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import Event, OnlineEvent, PhysicalEvent, User
from config.tests import BaseMongoTestCase


class EventViewsTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        self.enterContext(override_settings(
            ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="event-tests-only-signing-key-at-least-32-bytes",
        ))
        self.client = Client(enforce_csrf_checks=True)
        self.owner = "organizer-owner"
        self.details = {
            "title": "Backend Conference", "status": "published",
            "continent": "Europe", "country": "Hungary", "available_tickets": 50,
        }

    def tearDown(self):
        Event.drop_collection()
        super().tearDown()

    def authorization(self, user_id=None, role="organizer", **claims):
        now = datetime.now(timezone.utc)
        token = jwt.encode({
            "user_id": user_id or self.owner, "role": role,
            "iat": now, "exp": now + timedelta(hours=1), **claims,
        }, settings.SECRET_KEY, algorithm="HS256")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def write(self, method, data=None, event_id=None, authorization=None):
        path = "/api/events/" if event_id is None else f"/api/events/{event_id}/"
        return getattr(self.client, method)(
            path, data if data is not None else {}, content_type="application/json",
            **(authorization if authorization is not None else self.authorization()),
        )

    def event(self, **changes):
        return Event(**{**self.details, "organizer_id": self.owner, **changes}).save()

    def test_public_reads_serialize_base_and_subtype_fields(self):
        self.assertEqual(self.client.get("/api/events/").json(), [])
        events = [
            self.event(),
            PhysicalEvent(**self.details, organizer_id=self.owner,
                          venue_name="Main Hall", address="1 Main Street").save(),
            OnlineEvent(**self.details, organizer_id=self.owner,
                        stream_url="https://example.com/live").save(),
        ]
        response = self.client.get("/api/events/")
        self.assertEqual(response.status_code, 200)
        listing = {item["id"]: item for item in response.json()}
        self.assertEqual(len(listing), 3)
        for event, event_type in zip(events, ("event", "physical", "online")):
            with self.subTest(event_type=event_type):
                detail = self.client.get(f"/api/events/{event.id}/")
                self.assertEqual(detail.status_code, 200)
                body = detail.json()
                self.assertEqual(body, listing[str(event.id)])
                self.assertEqual(body["event_type"], event_type)
                self.assertEqual(body["organizer_id"], self.owner)
                for key, value in self.details.items():
                    self.assertEqual(body[key], value)
                self.assertNotIn("_cls", body)
                self.assertNotIn("_id", body)
        self.assertEqual(listing[str(events[1].id)]["venue_name"], "Main Hall")
        self.assertEqual(listing[str(events[1].id)]["address"], "1 Main Street")
        self.assertEqual(listing[str(events[2].id)]["stream_url"], "https://example.com/live")

    def test_create_uses_jwt_identity_and_defaults(self):
        response = self.write("post", {"title": "New Event", "organizer_id": "spoofed"})
        self.assertEqual(response.status_code, 201)
        body = response.json()
        saved = Event.objects.get(id=body["id"])
        self.assertEqual(saved.organizer_id, self.owner)
        self.assertEqual(body["organizer_id"], self.owner)
        self.assertEqual(body["event_type"], "event")
        self.assertEqual(body["available_tickets"], 0)

    def test_create_and_update_subtypes_preserve_type_and_omitted_fields(self):
        for event_type, model, fields, change in (
            ("physical", PhysicalEvent, {"venue_name": "Hall", "address": "1 Main St"}, {"address": "2 Main St"}),
            ("online", OnlineEvent, {"stream_url": "https://example.com/old"}, {"stream_url": "https://example.com/new"}),
        ):
            with self.subTest(event_type=event_type):
                created = self.write("post", {**self.details, **fields, "event_type": event_type})
                self.assertEqual(created.status_code, 201)
                event_id = created.json()["id"]
                updated = self.write("put", {**change, "event_type": event_type}, event_id)
                self.assertEqual(updated.status_code, 200)
                saved = Event.objects.get(id=event_id)
                self.assertIsInstance(saved, model)
                for key, value in {**self.details, **fields, **change}.items():
                    self.assertEqual(getattr(saved, key), value)
                self.assertEqual(updated.json()["event_type"], event_type)

    def test_owner_can_update_without_reassigning_organizer_and_delete(self):
        event = self.event()
        response = self.write("put", {"title": "Revised", "available_tickets": 0,
                                      "organizer_id": "other-organizer"}, str(event.id))
        self.assertEqual(response.status_code, 200)
        event.reload()
        self.assertEqual(event.title, "Revised")
        self.assertEqual(event.available_tickets, 0)
        self.assertEqual(event.country, "Hungary")
        self.assertEqual(event.organizer_id, self.owner)
        deleted = self.write("delete", event_id=str(event.id))
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(deleted.content, b"")
        self.assertEqual(Event.objects.count(), 0)

    def test_other_organizers_cannot_update_or_delete_even_with_spoofed_owner(self):
        event = self.event()
        original = event.to_mongo().to_dict()
        for method in ("put", "delete"):
            for claimed_owner in (self.owner, "other-organizer"):
                with self.subTest(method=method, claimed_owner=claimed_owner):
                    response = self.write(method, {"title": "Stolen", "organizer_id": claimed_owner},
                                          str(event.id), self.authorization("other-organizer"))
                    self.assertEqual(response.status_code, 403)
                    self.assertEqual(event.reload().to_mongo().to_dict(), original)

    def test_all_writes_require_valid_organizer_token(self):
        event = self.event()
        original = event.to_mongo().to_dict()
        headers = [
            {}, {"HTTP_AUTHORIZATION": "Bearer invalid"},
            self.authorization(role="attendee"), self.authorization(role="admin"),
            self.authorization(exp=datetime.now(timezone.utc) - timedelta(seconds=1)),
        ]
        for authorization in headers:
            for method in ("post", "put", "delete"):
                with self.subTest(method=method, authorization=authorization):
                    response = self.write(method, self.details,
                                          None if method == "post" else str(event.id), authorization)
                    self.assertEqual(response.status_code, 403)
                    self.assertEqual(Event.objects.count(), 1)
                    self.assertEqual(event.reload().to_mongo().to_dict(), original)

    def test_invalid_ids_are_not_found_for_reads_and_writes(self):
        for event_id in ("invalid-id", "012345678901234567890123"):
            for method in ("get", "put", "delete"):
                with self.subTest(event_id=event_id, method=method):
                    response = self.write(method, self.details, event_id)
                    self.assertEqual(response.status_code, 404)

    def test_unsupported_methods_return_405(self):
        event = self.event()
        for event_id, methods, allowed in (
            (None, ("put", "delete", "patch", "head", "options"), "GET, POST"),
            (str(event.id), ("post", "patch", "head", "options"), "GET, PUT, DELETE"),
        ):
            for method in methods:
                with self.subTest(event_id=event_id, method=method):
                    response = self.write(method, self.details, event_id)
                    self.assertEqual(response.status_code, 405)
                    self.assertEqual(response["Allow"], allowed)

    def test_invalid_json_never_changes_persisted_events(self):
        event = self.event()
        original = event.to_mongo().to_dict()
        for body in (b"", b"{", b"null", b"[]", b"true", b"42", b'{"title":"\xff"}', b"[" * 2000):
            for method in ("post", "put"):
                with self.subTest(body=body[:40], method=method):
                    path = "/api/events/" if method == "post" else f"/api/events/{event.id}/"
                    response = getattr(self.client, method)(path, body, content_type="application/json",
                                                           **self.authorization())
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(Event.objects.count(), 1)
                    self.assertEqual(event.reload().to_mongo().to_dict(), original)

    def test_invalid_fields_do_not_create_or_partially_update_events(self):
        event = self.event()
        original = event.to_mongo().to_dict()
        invalid_changes = [
            {"title": value} for value in (None, "", " ", 42, True, [], {})
        ] + [
            {field: value} for field in ("status", "continent", "country")
            for value in (None, 42, True, [], {})
        ] + [
            {"available_tickets": value} for value in (-1, 2**63, True, False, 1.0, "2", None, [], {})
        ] + [
            {field: "untrusted"} for field in ("_cls", "_id", "id", "unknown", "stream_url", "venue_name")
        ] + [{"event_type": value} for value in (None, "unknown", "online", "physical", 42, [])]
        for changes in invalid_changes:
            for method in ("post", "put"):
                with self.subTest(changes=changes, method=method):
                    response = self.write(method, {**self.details, "title": "Changed", **changes},
                                          None if method == "post" else str(event.id))
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(Event.objects.count(), 1)
                    self.assertEqual(event.reload().to_mongo().to_dict(), original)
        self.assertEqual(self.write("post", {}).status_code, 400)

    def test_largest_bson_ticket_count_is_accepted(self):
        response = self.write("post", {"title": "Large Event", "available_tickets": 2**63 - 1})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["available_tickets"], 2**63 - 1)
        event_id = response.json()["id"]
        self.assertEqual(self.write("put", {"available_tickets": 2**63 - 1}, event_id).status_code, 200)

    def test_subtype_required_fields_and_invalid_stream_url(self):
        for data in (
            {"event_type": "physical"},
            {"event_type": "physical", "venue_name": "Hall", "address": " "},
            {"event_type": "physical", "venue_name": 42, "address": "1 Main St"},
            {"event_type": "online"},
            {"event_type": "online", "stream_url": "not-a-url"},
            {"event_type": "online", "stream_url": True},
        ):
            with self.subTest(data=data):
                self.assertEqual(self.write("post", {"title": "Conference", **data}).status_code, 400)
        self.assertEqual(Event.objects.count(), 0)
        event = OnlineEvent(**self.details, organizer_id=self.owner,
                            stream_url="https://example.com/live").save()
        for changes in ({"stream_url": "invalid"}, {"event_type": "event"}, {"venue_name": "Hall"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.write("put", {"title": "Changed", **changes}, str(event.id)).status_code, 400)
                event.reload()
                self.assertEqual(event.title, self.details["title"])
                self.assertEqual(event.stream_url, "https://example.com/live")

    def test_token_from_login_can_create_update_and_delete_owned_event(self):
        user = User(email="owner@example.com", role="organizer")
        user.set_password("event test password")
        user.save()
        login = self.client.post("/api/auth/login/", {
            "email": user.email, "password": "event test password",
        }, content_type="application/json")
        self.assertEqual(login.status_code, 200)
        authorization = {"HTTP_AUTHORIZATION": f"Bearer {login.json()['token']}"}
        created = self.write("post", self.details, authorization=authorization)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["organizer_id"], str(user.id))
        event_id = created.json()["id"]
        self.assertEqual(self.write("put", {"title": "Updated"}, event_id, authorization).status_code, 200)
        self.assertEqual(self.write("delete", event_id=event_id, authorization=authorization).status_code, 204)
