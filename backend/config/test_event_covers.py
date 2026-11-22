"""Cover photo upload: content-based validation, ownership, size limit and serving."""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.test import Client, override_settings

from config.models import MAX_COVER_BYTES, Event, EventCover
from config.tests import BaseMongoTestCase

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x24\x00\x00\x00WEBP" + b"\x00" * 32
GIF = b"GIF89a" + b"\x00" * 32
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


class EventCoverTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        EventCover.drop_collection()
        self.enterContext(override_settings(
            ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="event-tests-only-signing-key-at-least-32-bytes",
        ))
        self.client = Client(enforce_csrf_checks=True)
        self.owner = "organizer-owner"
        self.event = Event(title="Night market", organizer_id=self.owner, available_tickets=7).save()
        self.url = f"/api/events/{self.event.id}/cover/"

    def tearDown(self):
        Event.drop_collection()
        EventCover.drop_collection()
        super().tearDown()

    def auth(self, user_id=None, role="organizer"):
        now = datetime.now(timezone.utc)
        token = jwt.encode({"user_id": user_id or self.owner, "role": role,
                            "iat": now, "exp": now + timedelta(hours=1)},
                           settings.SECRET_KEY, algorithm="HS256")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def put(self, data, content_type="image/png", url=None, **auth):
        return self.client.put(url or self.url, data, content_type=content_type,
                               **(auth or self.auth()))

    def test_accepts_png_jpeg_and_webp_and_serves_them_back(self):
        for data, expected in ((PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")):
            with self.subTest(expected=expected):
                response = self.put(data)
                self.assertEqual(response.status_code, 200, response.content)
                self.assertRegex(response.json()["cover_url"], rf"^/api/events/{self.event.id}/cover/\?v=\d+$")
                served = self.client.get(self.url)
                self.assertEqual(served.status_code, 200)
                self.assertEqual(served.content, data)
                self.assertEqual(served["Content-Type"], expected)
                self.assertEqual(served["X-Content-Type-Options"], "nosniff")
                self.assertEqual(served["Content-Security-Policy"], "default-src 'none'")

    def test_type_comes_from_the_bytes_not_the_declared_content_type(self):
        for label, data in (("gif", GIF), ("svg", SVG), ("text", b"not an image")):
            with self.subTest(label=label):
                response = self.put(data, content_type="image/png")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(EventCover.objects.count(), 0)
        self.assertIsNone(Event.objects.get(id=self.event.id).cover_updated_at)

    def test_a_png_sent_with_a_wrong_content_type_is_stored_as_png(self):
        self.assertEqual(self.put(PNG, content_type="text/plain").status_code, 200)
        self.assertEqual(self.client.get(self.url)["Content-Type"], "image/png")

    def test_rejects_files_over_the_limit_and_accepts_exactly_the_limit(self):
        padding = PNG + b"\x00" * (MAX_COVER_BYTES - len(PNG))
        self.assertEqual(len(padding), MAX_COVER_BYTES)
        self.assertEqual(self.put(padding).status_code, 200)
        self.assertEqual(self.put(padding + b"\x00").status_code, 413)

    def test_empty_body_is_rejected(self):
        self.assertEqual(self.put(b"").status_code, 400)

    def test_only_the_owning_organizer_may_upload(self):
        self.assertEqual(self.put(PNG, **self.auth("someone-else")).status_code, 403)
        self.assertEqual(self.put(PNG, **self.auth(role="attendee")).status_code, 403)
        self.assertEqual(self.client.put(self.url, PNG, content_type="image/png").status_code, 403)
        self.assertEqual(EventCover.objects.count(), 0)

    def test_unknown_and_malformed_event_ids_return_404(self):
        for event_id in ("0" * 24, "not-an-object-id"):
            with self.subTest(event_id=event_id):
                url = f"/api/events/{event_id}/cover/"
                self.assertEqual(self.put(PNG, url=url).status_code, 404)
                self.assertEqual(self.client.get(url).status_code, 404)

    def test_get_without_a_cover_is_404_and_listing_shows_null(self):
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertIsNone(self.client.get("/api/events/").json()[0]["cover_url"])

    def test_replacing_keeps_one_document_and_changes_the_url_version(self):
        first = self.put(PNG).json()["cover_url"]
        second = self.put(JPEG).json()["cover_url"]
        self.assertEqual(EventCover.objects.count(), 1)
        self.assertEqual(self.client.get(self.url).content, JPEG)
        self.assertNotEqual(first, second)

    def test_upload_does_not_touch_other_event_fields(self):
        self.put(PNG)
        event = Event.objects.get(id=self.event.id)
        self.assertEqual((event.title, event.available_tickets), ("Night market", 7))

    def test_cover_url_cannot_be_set_through_the_json_api(self):
        response = self.client.put(f"/api/events/{self.event.id}/", {"cover_url": "https://evil.example/x.png"},
                                   content_type="application/json", **self.auth())
        self.assertEqual(response.status_code, 400)

    def test_deleting_the_event_deletes_its_cover(self):
        self.put(PNG)
        response = self.client.delete(f"/api/events/{self.event.id}/", **self.auth())
        self.assertEqual(response.status_code, 204)
        self.assertEqual(EventCover.objects.count(), 0)
