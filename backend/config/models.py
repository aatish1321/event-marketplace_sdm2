import datetime
import os
from django.conf import settings
from django.contrib.auth.hashers import (
    check_password as django_check_password,
    is_password_usable,
    make_password as django_make_password,
)
from mongoengine import (
    BinaryField,
    DateTimeField,
    Document,
    EmailField,
    EmbeddedDocument,
    EmbeddedDocumentField,
    IntField,
    PointField,
    StringField,
    URLField,
    ValidationError,
)

__all__ = [
    "OrganizerProfile",
    "User",
    "Event",
    "PhysicalEvent",
    "OnlineEvent",
    "EventCover",
    "MAX_COVER_BYTES",
    "BuyerSnapshot",
    "EventSnapshot",
    "TicketPurchase",
    "SystemLog",
]


def _ensure_django_settings():
    """Ensure Django settings are configured for password hashing."""
    if not settings.configured and not os.environ.get("DJANGO_SETTINGS_MODULE"):
        settings.configure(
            SECRET_KEY=os.environ.get(
                "DJANGO_SECRET_KEY", "standalone-fallback-secret-key-for-hashing"
            )
        )


class OrganizerProfile(EmbeddedDocument):
    """Embedded document representing an organizer's profile details."""

    name = StringField()
    contact_email = EmailField()
    organization_id = StringField()

    def __str__(self):
        return self.name or super().__str__()


class User(Document):
    """User document representing application users and credentials."""

    ROLE_ATTENDEE = "attendee"
    ROLE_ORGANIZER = "organizer"
    ROLE_ADMIN = "admin"
    ROLE_CHOICES = (ROLE_ATTENDEE, ROLE_ORGANIZER, ROLE_ADMIN)
    ROLES = ROLE_CHOICES

    email = EmailField(required=True, unique=True)
    password_hash = StringField()
    full_name = StringField()
    role = StringField(choices=ROLE_CHOICES)
    organizer_profile = EmbeddedDocumentField(OrganizerProfile)

    meta = {
        "indexes": [
            "email",
        ],
    }

    def set_password(self, raw_password):
        """Hash the provided raw password and store in password_hash."""
        _ensure_django_settings()
        self.password_hash = django_make_password(raw_password)

    def check_password(self, raw_password):
        """Verify raw password against password_hash using Django password hashers."""
        if not self.password_hash:
            return False
        _ensure_django_settings()

        def setter(raw):
            self.set_password(raw)
            if self.pk and not getattr(self, "_created", True):
                try:
                    self.update(set__password_hash=self.password_hash)
                except Exception:
                    pass

        return django_check_password(raw_password, self.password_hash, setter)

    def has_usable_password(self):
        """Return True if password_hash is set to a usable password."""
        if not self.password_hash:
            return False
        _ensure_django_settings()
        return is_password_usable(self.password_hash)

    def set_unusable_password(self):
        """Mark user as having no usable password."""
        self.set_password(None)

    def __str__(self):
        return self.email or super().__str__()


def _mongo_utc_now():
    """Use MongoDB's naive UTC millisecond representation consistently."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.replace(tzinfo=None, microsecond=(now.microsecond // 1000) * 1000)


def _validate_available_tickets(value):
    # Validate stored inventory without rejecting the negative delta of atomic decrements.
    IntField(min_value=0).validate(value)


MAX_SAFE_AMOUNT = 9007199254740991
CURRENCIES = ("EUR", "USD", "HUF")


def _validate_amount(value):
    if type(value) is not int or not 0 <= value <= MAX_SAFE_AMOUNT:
        raise ValidationError("Amount must be a non-negative safe integer in minor units.")


class Event(Document):
    """Shared event details stored in a polymorphic event collection."""

    title = StringField(required=True)
    organizer_id = StringField(required=True)
    status = StringField()
    continent = StringField()
    country = StringField()
    available_tickets = IntField(default=0, validation=_validate_available_tickets)
    ticket_price_minor = IntField(null=True, validation=_validate_amount)
    currency = StringField(null=True, choices=CURRENCIES)
    description = StringField(default="", max_length=5000)
    start_at = DateTimeField()
    end_at = DateTimeField()
    created_at = DateTimeField(default=_mongo_utc_now)
    # Set when a cover photo exists; the bytes live in EventCover so event lists stay small.
    cover_updated_at = DateTimeField()

    meta = {
        "allow_inheritance": True,
        "indexes": [
            # Keep geography first for queries across all event types.
            {"fields": ["continent", "country"], "cls": False},
            {"fields": ["organizer_id", "start_at"], "cls": False},
        ],
    }

    def clean(self):
        if (self.ticket_price_minor is None) != (self.currency is None):
            raise ValidationError("Provide ticket_price_minor and currency together.")


MAX_COVER_BYTES = 2 * 1024 * 1024


class EventCover(Document):
    """Cover photo bytes for one event, validated by content type before they are stored."""

    event_id = StringField(required=True, unique=True)
    content_type = StringField(required=True, choices=("image/jpeg", "image/png", "image/webp"))
    data = BinaryField(required=True, max_bytes=MAX_COVER_BYTES)


def validate_location(value):
    """Validate a two-dimensional GeoJSON point in longitude/latitude order."""
    if not isinstance(value, dict) or set(value) != {"type", "coordinates"}:
        raise ValidationError("location must be a GeoJSON Point.")
    coordinates = value["coordinates"]
    if value["type"] != "Point" or not isinstance(coordinates, (list, tuple)) or len(coordinates) != 2:
        raise ValidationError("location must contain exactly two Point coordinates.")
    for coordinate, bound in zip(coordinates, (180, 90)):
        # Range comparisons also reject NaN and infinities without float coercion.
        if type(coordinate) not in (int, float) or not -bound <= coordinate <= bound:
            raise ValidationError("location coordinates must be finite longitude/latitude values.")


class PhysicalEvent(Event):
    """An event hosted at a physical venue."""

    venue_name = StringField(required=True)
    address = StringField(required=True)
    location = PointField(validation=validate_location)


class OnlineEvent(Event):
    """An event hosted through an online stream."""

    stream_url = URLField(required=True)


class BuyerSnapshot(EmbeddedDocument):
    """Buyer details retained independently of later account changes."""

    user_id = StringField(required=True)
    email = EmailField(required=True)
    full_name = StringField()


class EventSnapshot(EmbeddedDocument):
    """Event details retained independently of later edits or deletion."""

    event_id = StringField(required=True)
    title = StringField(required=True)
    organizer_id = StringField(required=True)
    event_type = StringField(required=True, choices=("event", "physical", "online"))
    start_at = DateTimeField()
    end_at = DateTimeField()
    venue_name = StringField()
    address = StringField()
    stream_url = StringField()


class TicketPurchase(Document):
    """Purchased quantity with embedded historical buyer and event details."""

    buyer_snapshot = EmbeddedDocumentField(BuyerSnapshot, required=True)
    event_snapshot = EmbeddedDocumentField(EventSnapshot, required=True)
    quantity = IntField(required=True, min_value=1, max_value=2**63 - 1)
    created_at = DateTimeField(default=_mongo_utc_now)
    unit_price_minor = IntField(null=True, validation=_validate_amount)
    total_amount_minor = IntField(null=True, validation=_validate_amount)
    currency = StringField(null=True, choices=CURRENCIES)

    meta = {
        "indexes": [
            ("buyer_snapshot.user_id", "-created_at", "-id"),
            "event_snapshot.organizer_id",
        ],
    }

    def clean(self):
        amounts = (self.unit_price_minor, self.total_amount_minor, self.currency)
        if all(value is None for value in amounts):
            return
        if any(value is None for value in amounts):
            raise ValidationError("Purchase amounts and currency must be recorded together.")
        if self.total_amount_minor != self.unit_price_minor * self.quantity:
            raise ValidationError("Purchase total must equal quantity times unit price.")


class SystemLog(Document):
    """Document representing application logs and error diagnostics."""

    level = StringField()
    endpoint = StringField()
    method = StringField()
    status_code = IntField()
    message = StringField()
    traceback = StringField()
    timestamp = DateTimeField(default=_mongo_utc_now)

    def __str__(self):
        parts = []
        if self.level:
            parts.append(f"[{self.level}]")
        http_details = " ".join(
            str(x)
            for x in [self.method, self.endpoint, self.status_code]
            if x is not None and str(x).strip()
        )
        if http_details:
            parts.append(http_details)
        if self.message:
            parts.append(f"- {self.message}" if http_details else self.message)
        if parts:
            return " ".join(parts)
        return super().__str__()
