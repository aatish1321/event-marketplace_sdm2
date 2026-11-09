"""Real MongoDB spatial checks, opt-in via GEODISCOVERY_TEST_MONGO_URI.

Always uses a uniquely named disposable database, never the URI's database.
Mongomock cannot establish geospatial correctness.
"""

import copy
import os
import unittest
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import mongoengine
from django.test import Client, override_settings

from config.tests import BaseMongoTestCase  # Initialize Django consistently with other tests.
from config.models import Event, OnlineEvent, PhysicalEvent


@unittest.skipUnless(os.environ.get("GEODISCOVERY_TEST_MONGO_URI"), "Set GEODISCOVERY_TEST_MONGO_URI for real MongoDB spatial tests.")
class MongoDiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.saved_connections = copy.deepcopy(mongoengine.connection._connection_settings)
        cls.database_name = f"geodiscovery_test_{uuid4().hex}"
        parts = urlsplit(os.environ["GEODISCOVERY_TEST_MONGO_URI"])
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
        self.enterContext(override_settings(ALLOWED_HOSTS=["testserver"]))
        Event.drop_collection()
        PhysicalEvent.ensure_indexes()
        self.client = Client()

    def tearDown(self):
        Event.drop_collection()

    def physical(self, title, longitude=None, latitude=0, **changes):
        fields = dict(title=title, organizer_id="owner", venue_name="Hall", address="Street",
                      continent="Europe", country="Hungary")
        if longitude is not None:
            fields["location"] = {"type": "Point", "coordinates": [longitude, latitude]}
        return PhysicalEvent(**{**fields, **changes}).save()

    def nearby(self, **changes):
        response = self.client.get("/api/events/nearby/", {
            "latitude": 0, "longitude": 0, "radius_km": 10, **changes,
        })
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_radius_nearest_order_limit_and_distance_units(self):
        far = self.physical("Far", 0.05)
        close = self.physical("Close", 0.01)
        self.physical("Outside", 0.2)
        items = self.nearby()
        self.assertEqual([item["id"] for item in items], [str(close.id), str(far.id)])
        self.assertAlmostEqual(items[0]["distance_km"], 1.113, delta=0.02)
        self.assertAlmostEqual(items[1]["distance_km"], 5.566, delta=0.03)
        self.assertEqual([item["id"] for item in self.nearby(limit=1)], [str(close.id)])

    def test_exact_filters_apply_before_limit(self):
        self.physical("Other country", 0.001, country="Austria")
        self.physical("Other continent", 0.002, continent="Asia")
        target = self.physical("Target", 0.03)
        items = self.nearby(continent="Europe", country="Hungary", limit=1)
        self.assertEqual([item["id"] for item in items], [str(target.id)])
        self.assertEqual(self.nearby(country="hungary"), [])

    def test_radius_excludes_just_outside_and_includes_just_inside(self):
        event = self.physical("Boundary", 0.01)
        distance = self.nearby()[0]["distance_km"]
        self.assertEqual(self.nearby(radius_km=distance - 0.001), [])
        self.assertEqual([item["id"] for item in self.nearby(radius_km=distance + 0.001)], [str(event.id)])

    def test_missing_coordinates_and_other_types_are_excluded(self):
        target = self.physical("Located", 0.01)
        self.physical("Legacy without location")
        self.physical("Explicit null", location=None)
        base = Event(title="Base", organizer_id="owner").save()
        online = OnlineEvent(title="Online", organizer_id="owner", stream_url="https://example.com/live").save()
        # Even legacy raw records with coordinates must be excluded by discriminator.
        Event._get_collection().update_many({"_id": {"$in": [base.id, online.id]}}, {
            "$set": {"location": {"type": "Point", "coordinates": [0, 0]}}
        })
        self.assertEqual([item["id"] for item in self.nearby()], [str(target.id)])

    def test_dateline_uses_spherical_distance(self):
        nearby = self.physical("Across dateline", -179.99)
        self.physical("Too far", 179)
        items = self.nearby(longitude=179.99, radius_km=5)
        self.assertEqual([item["id"] for item in items], [str(nearby.id)])
        self.assertAlmostEqual(items[0]["distance_km"], 2.226, delta=0.03)

    def test_index_exists_and_empty_collection_returns_empty_list(self):
        indexes = Event._get_collection().index_information()
        self.assertTrue(any(("location", "2dsphere") in index["key"] for index in indexes.values()))
        self.assertEqual(self.nearby(), [])
