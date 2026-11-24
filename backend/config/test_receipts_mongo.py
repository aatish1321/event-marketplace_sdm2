"""Opt-in Decimal128 aggregation checks against an isolated real MongoDB database."""

import copy
import os
import unittest
from decimal import Decimal
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import mongoengine
from django.test import Client, override_settings

from config.test_receipts import ReceiptFixtures
from config.models import Event, PhysicalEvent, OnlineEvent, Ticket


@unittest.skipUnless(os.environ.get("RECEIPTS_TEST_MONGO_URI"), "Set RECEIPTS_TEST_MONGO_URI for real MongoDB receipt tests.")
class MongoReceiptTests(ReceiptFixtures, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.saved_connections = copy.deepcopy(mongoengine.connection._connection_settings)
        cls.database_name = f"receipts_test_{uuid4().hex}"
        parts = urlsplit(os.environ["RECEIPTS_TEST_MONGO_URI"])
        uri = urlunsplit((parts.scheme, parts.netloc, f"/{cls.database_name}", parts.query, parts.fragment))
        mongoengine.disconnect_all()
        cls.addClassCleanup(cls.restore_connections)
        cls.connection = mongoengine.connect(host=uri, serverSelectionTimeoutMS=5000)
        cls.connection.admin.command("ping")
        cls.connected = True

    @classmethod
    def restore_connections(cls):
        try:
            if getattr(cls, "connected", False):
                cls.connection.drop_database(cls.database_name)
        finally:
            mongoengine.disconnect_all()
            for alias, options in cls.saved_connections.items():
                mongoengine.register_connection(alias, **options)

    def setUp(self):
        self.enterContext(override_settings(ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="receipt-tests-only-signing-secret-at-least-32-bytes"))
        Event.drop_collection()
        Ticket.drop_collection()
        self.client = Client()

    def tearDown(self):
        Ticket.drop_collection()
        Event.drop_collection()

    def test_decimal_totals_and_currency_grouping_across_event_types(self):
        physical = self.event(model=PhysicalEvent)
        online = self.event(model=OnlineEvent)
        self.ticket(physical, total_paid=Decimal("0.10"), quantity=3)
        self.ticket(online, total_paid=Decimal("0.20"), quantity=2)
        self.ticket(online, currency="USD", total_paid=Decimal("9.99"))
        self.assertEqual(self.revenue(), [
            {"currency": "EUR", "total_revenue": "0.30", "tickets_sold": 5, "receipt_count": 2},
            {"currency": "USD", "total_revenue": "9.99", "tickets_sold": 1, "receipt_count": 1},
        ])

    def test_owner_status_and_deleted_event_exclusions(self):
        own = self.event()
        self.ticket(own, total_paid=Decimal("2.00"))
        for status in ("pending", "refunded", "cancelled"):
            self.ticket(own, total_paid=Decimal("100"), status=status)
        self.ticket(self.event(owner="other"), total_paid=Decimal("200"))
        deleted = self.event()
        self.ticket(deleted, total_paid=Decimal("300"))
        deleted.delete()
        self.assertEqual(self.revenue(), [
            {"currency": "EUR", "total_revenue": "2.00", "tickets_sold": 1, "receipt_count": 1},
        ])
        own.update(set__organizer_id="new-owner")
        self.assertEqual(self.revenue(), [])
        self.assertEqual(self.revenue("new-owner")[0]["total_revenue"], "2.00")

    def test_receipt_indexes_and_snapshot_persistence(self):
        event = self.event()
        ticket = self.ticket(event)
        event.delete()
        body = self.client.get("/api/user/tickets/", **self.auth()).json()
        self.assertEqual(body["tickets"][0]["id"], str(ticket.id))
        self.assertEqual(body["tickets"][0]["event_title"], "Original Event")
        keys = [index["key"] for index in Ticket._get_collection().index_information().values()]
        self.assertIn([("user_id", 1), ("created_at", -1), ("_id", -1)], keys)
        self.assertIn([("event_id", 1), ("status", 1)], keys)
