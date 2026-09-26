import datetime
import os
from django.conf import settings
from django.contrib.auth.hashers import (
    check_password as django_check_password,
    is_password_usable,
    make_password as django_make_password,
)
from mongoengine import (
    DateTimeField,
    Document,
    EmailField,
    EmbeddedDocument,
    EmbeddedDocumentField,
    IntField,
    StringField,
)

__all__ = [
    "OrganizerProfile",
    "User",
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
