import datetime
import os
from decimal import Decimal, InvalidOperation
from django.conf import settings
from django.contrib.auth.hashers import (
    check_password as django_check_password,
    is_password_usable,
    make_password as django_make_password,
)
from mongoengine import (
    DateTimeField,
    Decimal128Field,
    Document,
    EmailField,
    EmbeddedDocument,
    EmbeddedDocumentField,
    IntField,
    ObjectIdField,
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
    "Ticket",
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


class Event(Document):
    """Shared event details stored in a polymorphic event collection."""

    title = StringField(required=True)
    organizer_id = StringField(required=True)
    status = StringField()
    continent = StringField()
    country = StringField()
    available_tickets = IntField(default=0, min_value=0)

    meta = {
        "allow_inheritance": True,
        "indexes": [
            # Keep geography first for queries across all event types.
            {"fields": ["continent", "country"], "cls": False},
            {"fields": ["organizer_id"], "cls": False},
        ],
    }


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


def _validate_nonblank(value):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("Value must not be blank.")


def _validate_receipt_amount(value):
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValidationError("total_paid must be a decimal amount.") from exc
    if not amount.is_finite() or amount < 0:
        raise ValidationError("total_paid must be finite and non-negative.")


class Ticket(Document):
    """A purchase receipt with a historical title and full transaction amount."""

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_REFUNDED = "refunded"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (STATUS_PENDING, STATUS_PAID, STATUS_REFUNDED, STATUS_CANCELLED)

    user_id = StringField(required=True, validation=_validate_nonblank)
    event_id = ObjectIdField(required=True)
    event_title = StringField(required=True, validation=_validate_nonblank)
    quantity = IntField(required=True, null=True, default=1, min_value=1, max_value=2**63 - 1)
    total_paid = Decimal128Field(required=True, validation=_validate_receipt_amount)
    currency = StringField(required=True, regex=r"^[A-Z]{3}$", min_length=3, max_length=3)
    status = StringField(required=True, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = DateTimeField(required=True, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    meta = {
        "indexes": [
            {"fields": ["user_id", "-created_at", "-id"]},
            {"fields": ["event_id", "status"]},
        ],
    }

    def __init__(self, *args, **values):
        # null=True preserves explicit None for required-field validation, but
        # MongoEngine also suppresses the field default. Default only omissions.
        values.setdefault("quantity", 1)
        super().__init__(*args, **values)


class SystemLog(Document):
    """Document representing application logs and error diagnostics."""

    level = StringField()
    endpoint = StringField()
    method = StringField()
    status_code = IntField()
    message = StringField()
    traceback = StringField()
    timestamp = DateTimeField(default=datetime.datetime.now)

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
