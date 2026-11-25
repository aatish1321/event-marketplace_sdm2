"""Ticket emails use saved buyer details and never undo a successful booking."""

from datetime import datetime, timedelta, timezone
from smtplib import SMTPException
from unittest.mock import patch
import time

import jwt
from django.conf import settings
from django.core import mail
from django.test import Client, override_settings
from mongoengine.errors import OperationError
import segno

from config.models import Event, OnlineEvent, PhysicalEvent, TicketPurchase, User
from config.tests import BaseMongoTestCase


class TicketEmailTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        for model in (Event, TicketPurchase):
            model.drop_collection()
            self.addCleanup(model.drop_collection)
        self.enterContext(override_settings(
            ALLOWED_HOSTS=["testserver"], SECRET_KEY="ticket-email-tests-only-secret-at-least-32-bytes",
            TICKET_EMAIL_ENABLED=True, DEFAULT_FROM_EMAIL="tickets@example.com",
            MAILERS={"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}},
            TEMPLATES=[{"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True}],
        ))
        self.enterContext(patch.object(mail.DNS_NAME, "get_fqdn", return_value="localhost"))
        mail.outbox = []
        self.client = Client(enforce_csrf_checks=True)
        self.buyer = User(email="buyer@example.com", full_name="Ticket Buyer", role="attendee").save()
        self.event = PhysicalEvent(
            title="Community concert", organizer_id="organizer", venue_name="Town Hall", address="Budapest",
            start_at=datetime.now(timezone.utc) + timedelta(days=1),
            end_at=datetime.now(timezone.utc) + timedelta(days=2),
            available_tickets=10, ticket_price_minor=1250, currency="EUR",
        ).save()

    def book(self, buyer=None, **payload):
        buyer = buyer or self.buyer
        token = jwt.encode({"user_id": str(buyer.id), "role": "attendee", "iat": int(time.time()) - 1,
            "exp": int(time.time()) + 3600}, settings.SECRET_KEY, algorithm="HS256")
        return self.client.post("/api/checkout/", {"event_id": str(self.event.id), "quantity": 2, **payload},
            content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")

    def bodies(self):
        message = mail.outbox[-1].message()
        plain = next(part.get_content() for part in message.walk() if part.get_content_type() == "text/plain")
        html = next(part.get_content() for part in message.walk() if part.get_content_type() == "text/html")
        image = next(part for part in message.walk() if part.get_content_type() == "image/png")
        return message, plain, html, image

    def test_booking_emails_ticket_and_signed_qr_to_the_saved_buyer(self):
        with patch("segno.make_qr", wraps=segno.make_qr) as make_qr:
            response = self.book()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["confirmation_email_status"], "sent")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.buyer.email])
        self.assertEqual(mail.outbox[0].from_email, "tickets@example.com")
        code = response.json()["admission_code"]
        make_qr.assert_called_once_with(code, error="m", mode="byte", boost_error=False)
        message, plain, html, image = self.bodies()
        for text in ("Community concert", "Town Hall", "Budapest", "EUR 25.00", code):
            self.assertIn(text, plain)
        self.assertIn("No payment was collected", plain)
        self.assertIn("UTC", html)
        self.assertIn(f'cid:ticket-{response.json()["id"]}', html)
        self.assertEqual(image["Content-ID"], f'<ticket-{response.json()["id"]}>')
        self.assertEqual(image.get_content_disposition(), "inline")
        self.assertTrue(image.get_payload(decode=True).startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertIn("multipart/related", [part.get_content_type() for part in message.walk()])

    def test_each_buyer_receives_their_own_email(self):
        other = User(email="another-buyer@example.com", role="attendee").save()
        self.assertEqual(self.book().status_code, 201)
        self.assertEqual(self.book(other).status_code, 201)
        self.assertEqual([message.to for message in mail.outbox], [[self.buyer.email], [other.email]])

    def test_client_cannot_redirect_email_to_another_recipient(self):
        self.assertEqual(self.book(email="other@example.com").status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_html_is_escaped_and_subject_cannot_inject_headers(self):
        self.event.update(set__title='Concert\n<img src=x onerror="bad()">')
        self.buyer.update(set__full_name="<script>bad()</script>")
        self.assertEqual(self.book().status_code, 201)
        _, plain, html, _ = self.bodies()
        self.assertIn('<img src=x onerror="bad()">', plain)
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img src=x", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertNotIn("\n", mail.outbox[0].subject)

    def test_online_booking_contains_its_event_link(self):
        self.event = OnlineEvent(title="Online workshop", organizer_id="organizer", available_tickets=3,
            stream_url="https://example.com/room").save()
        self.assertEqual(self.book().status_code, 201)
        _, plain, html, _ = self.bodies()
        self.assertIn("https://example.com/room", plain)
        self.assertIn('href="https://example.com/room"', html)
        self.assertIn("Amount not recorded", plain)

    def test_free_booking_is_not_reported_as_an_unknown_amount(self):
        self.event.update(set__ticket_price_minor=0)
        self.assertEqual(self.book().status_code, 201)
        self.assertIn("EUR 0.00", self.bodies()[1])

    def test_email_failure_keeps_the_booking_and_reserved_inventory(self):
        with patch("config.ticket_emails.EmailMessage.send", side_effect=SMTPException("Delivery failed")), self.assertLogs("config.ticket_emails", level="WARNING"):
            response = self.book()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["confirmation_email_status"], "failed")
        self.assertEqual(TicketPurchase.objects.count(), 1)
        self.assertEqual(self.event.reload().available_tickets, 8)

    def test_template_failure_also_keeps_the_booking(self):
        with patch("config.ticket_emails.render_to_string", side_effect=RuntimeError("Template failed")), self.assertLogs("config.ticket_emails", level="WARNING"):
            response = self.book()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["confirmation_email_status"], "failed")
        self.assertEqual(TicketPurchase.objects.count(), 1)

    def test_disabled_email_does_not_send_or_claim_delivery(self):
        with override_settings(TICKET_EMAIL_ENABLED=False), patch("config.ticket_emails.EmailMessage.send") as send:
            response = self.book()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["confirmation_email_status"], "not_configured")
        send.assert_not_called()

    def test_failed_reservations_and_failed_saves_never_send_email(self):
        self.assertEqual(self.book(quantity=11).status_code, 409)
        self.assertEqual(mail.outbox, [])
        with patch.object(TicketPurchase, "save", side_effect=OperationError("Insert failed")), patch("config.checkout_views.send_ticket_confirmation") as send:
            with self.assertRaises(OperationError):
                self.book()
            send.assert_not_called()
