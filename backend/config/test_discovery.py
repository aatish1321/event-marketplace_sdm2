"""Discovery validation and API contracts; spatial execution is tested separately."""

import time
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import Client, override_settings
from mongoengine.errors import ValidationError

from config.tests import BaseMongoTestCase
from config.models import Event, PhysicalEvent


def point(lon=19.04, lat=47.50):
    return {"type": "Point", "coordinates": [lon, lat]}


class DiscoveryTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        self.enterContext(override_settings(ALLOWED_HOSTS=["testserver"]))
        self.client = Client()
        self.details = {"title": "Conference", "organizer_id": "owner",
                        "venue_name": "Hall", "address": "Main Street",
                        "continent": "Europe", "country": "Hungary"}
        self.query = {"latitude": "47.5", "longitude": "19.04", "radius_km": "10"}
        token = jwt.encode({"user_id": "owner", "role": "organizer",
                            "iat": int(time.time()), "exp": int(time.time()) + 3600},
                           settings.SECRET_KEY, algorithm="HS256")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def tearDown(self):
        Event.drop_collection()
        super().tearDown()

    def test_model_accepts_optional_and_boundary_locations(self):
        for location in (None, point(), point(-180, -90), point(180, 90)):
            with self.subTest(location=location):
                event = PhysicalEvent(**self.details, location=location).save()
                self.assertEqual(event.reload().location, location)

    def test_model_rejects_malformed_locations(self):
        invalid = [[], [19, 47], "19,47", {}, {"type": "LineString", "coordinates": [19, 47]},
                   {"type": "Point"}, point(181, 0), point(0, 91), point(-181, 0), point(0, -91),
                   point(True, 0), point("19", 0), point(None, 0), point(float("nan"), 0),
                   point(0, float("inf")), {"type": "Point", "coordinates": [1]},
                   {"type": "Point", "coordinates": [1, 2, 3]}]
        for location in invalid:
            with self.subTest(location=location), self.assertRaises(ValidationError):
                PhysicalEvent(**self.details, location=location).validate()

    def test_location_crud_roundtrip_and_clear(self):
        payload = {**self.details, "event_type": "physical", "location": point()}
        response = self.client.post("/api/events/", payload, content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 201, response.content)
        event_id = response.json()["id"]
        url = f"/api/events/{event_id}/"
        self.assertEqual(self.client.get(url).json()["location"], point())
        for location in (point(20, 48), None):
            response = self.client.put(url, {"location": location}, content_type="application/json", **self.auth)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()["location"], location)
            self.assertEqual(PhysicalEvent.objects.get(id=event_id).location, location)

    def test_location_is_physical_only_and_invalid_update_is_not_saved(self):
        for event_type in ("event", "online"):
            payload = {"title": "Example", "event_type": event_type, "location": point()}
            if event_type == "online":
                payload["stream_url"] = "https://example.com/live"
            self.assertEqual(self.client.post("/api/events/", payload, content_type="application/json", **self.auth).status_code, 400)
        event = PhysicalEvent(**self.details, location=point()).save()
        response = self.client.put(f"/api/events/{event.id}/", {"location": point(181, 0)}, content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(event.reload().location, point())

    def test_existing_required_physical_fields_remain_required(self):
        for omitted in ("venue_name", "address"):
            payload = {**self.details, "event_type": "physical", "location": point()}
            del payload[omitted]
            self.assertEqual(self.client.post("/api/events/", payload, content_type="application/json", **self.auth).status_code, 400)

    def test_location_is_preserved_on_unrelated_updates_and_owner_protected(self):
        event = PhysicalEvent(**self.details, location=point()).save()
        url = f"/api/events/{event.id}/"
        response = self.client.put(url, {"title": "Renamed"}, content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(event.reload().location, point())
        event.organizer_id = "another-owner"
        event.save()
        response = self.client.put(url, {"location": None}, content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(event.reload().location, point())

    def test_nearby_pipeline_and_distance_serialization(self):
        event = PhysicalEvent(**self.details, location=point()).save()
        document = event.to_mongo().to_dict()
        document["distance_m"] = 1234.5
        with patch.object(PhysicalEvent._get_collection(), "aggregate", return_value=iter([document])) as aggregate:
            response = self.client.get("/api/events/nearby/", {**self.query, "continent": "Europe", "country": "Hungary", "limit": "3"})
        self.assertEqual(response.status_code, 200, response.content)
        result = response.json()[0]
        self.assertEqual(result["id"], str(event.id))
        self.assertEqual(result["event_type"], "physical")
        self.assertEqual(result["location"], point())
        self.assertAlmostEqual(result["distance_km"], 1.2345)
        self.assertNotIn("distance_m", result)
        self.assertNotIn("_cls", result)
        pipeline = aggregate.call_args.args[0]
        self.assertEqual(pipeline[0], {"$geoNear": {
            "near": point(), "key": "location", "distanceField": "distance_m",
            "maxDistance": 10000, "spherical": True,
            "query": {"_cls": PhysicalEvent._class_name, "continent": "Europe", "country": "Hungary"},
        }})
        self.assertEqual(pipeline[1], {"$limit": 3})

    def test_empty_result_and_default_limit(self):
        with patch.object(PhysicalEvent._get_collection(), "aggregate", return_value=[]) as aggregate:
            response = self.client.get("/api/events/nearby/", self.query)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        self.assertEqual(aggregate.call_args.args[0][1], {"$limit": 20})

    def test_query_validation_prevents_database_execution(self):
        queries = [{key: value for key, value in self.query.items() if key != missing}
                   for missing in self.query]
        for field, values in {
            "latitude": ["", "nan", "inf", "-inf", "91", "-91", "hello"],
            "longitude": ["181", "-181", "nan"],
            "radius_km": ["0", "-1", "1000.1", "inf", "nan"],
            "limit": ["0", "-1", "101", "1.5", "nan", ""],
            "continent": ["", "   "], "country": ["", "   "], "unexpected": ["value"],
        }.items():
            queries.extend({**self.query, field: value} for value in values)
        with patch.object(PhysicalEvent._get_collection(), "aggregate") as aggregate:
            for query in queries:
                with self.subTest(query=query):
                    self.assertEqual(self.client.get("/api/events/nearby/", query).status_code, 400)
            for field in (*self.query, "limit", "country", "continent"):
                with self.subTest(duplicate=field):
                    self.assertEqual(self.client.get("/api/events/nearby/", {**self.query, field: ["1", "2"]}).status_code, 400)
            aggregate.assert_not_called()

    def test_query_boundaries_and_method_restriction(self):
        with patch.object(PhysicalEvent._get_collection(), "aggregate", return_value=[]):
            for latitude, longitude in ((90, 180), (-90, -180)):
                response = self.client.get("/api/events/nearby/", {"latitude": latitude, "longitude": longitude, "radius_km": 1000, "limit": 100})
                self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.post("/api/events/nearby/").status_code, 405)
