"""Polymorphic event persistence and validation tests using mongomock."""

from mongoengine.errors import ValidationError

from config.models import Event, OnlineEvent, PhysicalEvent
from config.tests import BaseMongoTestCase


class EventModelTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        Event.drop_collection()
        self.details = {
            "title": "Backend Conference",
            "organizer_id": "organizer-123",
            "status": "published",
            "continent": "Europe",
            "country": "Hungary",
            "available_tickets": 50,
        }

    def tearDown(self):
        Event.drop_collection()
        super().tearDown()

    def test_base_queries_restore_subtypes_and_subtype_queries_filter(self):
        base = Event(**self.details).save()
        physical = PhysicalEvent(
            **self.details, venue_name="Conference Hall", address="1 Main Street"
        ).save()
        online = OnlineEvent(
            **self.details, stream_url="https://example.com/live"
        ).save()

        events = {event.id: event for event in Event.objects}
        self.assertEqual(len(events), 3)
        self.assertIs(type(events[base.id]), Event)
        self.assertIsInstance(events[physical.id], PhysicalEvent)
        self.assertIsInstance(events[online.id], OnlineEvent)
        self.assertEqual(events[physical.id].venue_name, "Conference Hall")
        self.assertEqual(events[physical.id].address, "1 Main Street")
        self.assertEqual(events[online.id].stream_url, "https://example.com/live")
        for event in events.values():
            for field, value in self.details.items():
                self.assertEqual(getattr(event, field), value)
        self.assertEqual(list(PhysicalEvent.objects), [physical])
        self.assertEqual(list(OnlineEvent.objects), [online])
        self.assertEqual(Event._get_collection().count_documents({}), 3)

    def test_geography_index_is_created_on_shared_collection(self):
        PhysicalEvent(
            **self.details, venue_name="Conference Hall", address="1 Main Street"
        ).save()
        OnlineEvent(**self.details, stream_url="https://example.com/live").save()
        OnlineEvent(
            **{**self.details, "country": "Austria"},
            stream_url="https://example.com/other",
        ).save()

        self.assertEqual(Event.objects(continent="Europe", country="Hungary").count(), 2)
        indexes = Event._get_collection().index_information()
        self.assertIn(
            [("continent", 1), ("country", 1)],
            [index["key"] for index in indexes.values()],
        )

    def test_ticket_counts_and_stream_urls_are_validated(self):
        event = Event(title="New Event", organizer_id="organizer-123")
        event.validate()
        self.assertEqual(event.available_tickets, 0)
        event.available_tickets = -1
        with self.assertRaises(ValidationError):
            event.validate()
        with self.assertRaises(ValidationError):
            OnlineEvent(**self.details, stream_url="not-a-url").validate()
