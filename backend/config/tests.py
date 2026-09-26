from concurrent.futures import ThreadPoolExecutor
import datetime
import os
import unittest

if not os.environ.get("DJANGO_SETTINGS_MODULE"):
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"

import django
try:
    django.setup()
except Exception:
    pass
from django.contrib.auth.hashers import PBKDF2PasswordHasher
import mongoengine
from mongoengine.errors import NotUniqueError, ValidationError
import mongomock

from config.models import OrganizerProfile, SystemLog, User


class BaseMongoTestCase(unittest.TestCase):
    """Base test case setting up in-memory MongoDB via mongomock."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        mongoengine.disconnect_all()
        cls.connection = mongoengine.connect(
            "test_marketplace_db",
            host="mongodb://localhost",
            mongo_client_class=mongomock.MongoClient,
            uuidRepresentation="standard",
        )

    @classmethod
    def tearDownClass(cls):
        mongoengine.disconnect_all()
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        User.drop_collection()
        SystemLog.drop_collection()

    def tearDown(self):
        User.drop_collection()
        SystemLog.drop_collection()
        super().tearDown()


class OrganizerProfileTests(BaseMongoTestCase):
    """Unit tests for OrganizerProfile EmbeddedDocument (Requirement R1)."""

    def test_organizer_profile_inheritance(self):
        """OrganizerProfile must be an EmbeddedDocument subclass."""
        self.assertTrue(issubclass(OrganizerProfile, mongoengine.EmbeddedDocument))

    def test_organizer_profile_creation_valid(self):
        """OrganizerProfile initializes and retains valid fields."""
        profile = OrganizerProfile(
            name="Tech Events LLC",
            contact_email="contact@techevents.io",
            organization_id="org_tech_123",
        )
        profile.validate()
        self.assertEqual(profile.name, "Tech Events LLC")
        self.assertEqual(profile.contact_email, "contact@techevents.io")
        self.assertEqual(profile.organization_id, "org_tech_123")

    def test_organizer_profile_optional_fields(self):
        """OrganizerProfile can be instantiated with optional or partial fields."""
        profile = OrganizerProfile(name="Minimal Org")
        profile.validate()
        self.assertEqual(profile.name, "Minimal Org")
        self.assertIsNone(profile.contact_email)
        self.assertIsNone(profile.organization_id)

    def test_organizer_profile_invalid_contact_email(self):
        """OrganizerProfile rejects invalid email format on validation."""
        profile = OrganizerProfile(
            name="Bad Email Org",
            contact_email="not-a-valid-email",
            organization_id="org_bad_1",
        )
        with self.assertRaises(ValidationError):
            profile.validate()

    def test_organizer_profile_str(self):
        """__str__ returns profile name or fallback."""
        profile = OrganizerProfile(name="Community Corp")
        self.assertEqual(str(profile), "Community Corp")

        empty_profile = OrganizerProfile()
        self.assertEqual(str(empty_profile), "OrganizerProfile object")


class UserModelTests(BaseMongoTestCase):
    """Unit tests for User Document (Requirement R2)."""

    def test_user_inheritance(self):
        """User must be a Document subclass."""
        self.assertTrue(issubclass(User, mongoengine.Document))

    def test_user_creation_valid(self):
        """User document can be saved and retrieved with all fields."""
        profile = OrganizerProfile(
            name="PyCon Org",
            contact_email="leads@pycon.org",
            organization_id="org_pycon",
        )
        user = User(
            email="organizer@pycon.org",
            full_name="Jane Doe",
            role="organizer",
            organizer_profile=profile,
        )
        user.set_password("SecurePassword#2026")
        user.save()

        saved_user = User.objects(email="organizer@pycon.org").first()
        self.assertIsNotNone(saved_user)
        self.assertEqual(saved_user.full_name, "Jane Doe")
        self.assertEqual(saved_user.role, "organizer")
        self.assertIsNotNone(saved_user.organizer_profile)
        self.assertEqual(saved_user.organizer_profile.name, "PyCon Org")
        self.assertEqual(saved_user.organizer_profile.contact_email, "leads@pycon.org")
        self.assertEqual(saved_user.organizer_profile.organization_id, "org_pycon")

    def test_set_password_hashes_input(self):
        """set_password must hash the password using Django password hashers (not plain text)."""
        user = User(email="attendee@example.com")
        raw_password = "MySuperSecretPassword123"

        user.set_password(raw_password)

        self.assertIsNotNone(user.password_hash)
        self.assertNotEqual(user.password_hash, raw_password)
        # Verify Django's password hasher signature (e.g., pbkdf2_sha256$...)
        self.assertIn("$", user.password_hash)
        hasher_name = user.password_hash.split("$")[0]
        self.assertIn(hasher_name, ["pbkdf2_sha256", "argon2", "bcrypt", "scrypt"])

    def test_check_password_validation(self):
        """check_password correctly validates correct and incorrect passwords."""
        user = User(email="user@example.com")
        raw_password = "CorrectHorseBatteryStaple"
        user.set_password(raw_password)

        # Valid password returns True
        self.assertTrue(user.check_password(raw_password))

        # Incorrect passwords return False
        self.assertFalse(user.check_password("WrongPassword"))
        self.assertFalse(user.check_password("correcthorsebatterystaple"))  # Case sensitive
        self.assertFalse(user.check_password(""))
        self.assertFalse(user.check_password(" "))

    def test_password_edge_cases(self):
        """Verify behavior with empty, unicode, None passwords and unset hashes."""
        user = User(email="edge@example.com")

        # Unset password_hash returns False safely
        self.assertIsNone(user.password_hash)
        self.assertFalse(user.check_password("any_password"))
        self.assertFalse(user.has_usable_password())

        # Empty password_hash string returns False safely
        user.password_hash = ""
        self.assertFalse(user.check_password("any_password"))
        self.assertFalse(user.has_usable_password())

        # check_password with None raw password returns False
        user.set_password("valid_pwd")
        self.assertFalse(user.check_password(None))

        # Empty string password can be hashed and validated
        user.set_password("")
        self.assertTrue(user.check_password(""))
        self.assertFalse(user.check_password("something_else"))

        # Unicode password with special characters
        unicode_pwd = "pàsswörd_🔒_123!@#"
        user.set_password(unicode_pwd)
        self.assertTrue(user.check_password(unicode_pwd))
        self.assertFalse(user.check_password("pàsswörd_🔒_123!@#_wrong"))

        # Unusable password
        user.set_unusable_password()
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.check_password("any"))
        self.assertFalse(user.check_password(None))

    def test_email_unique_constraint(self):
        """Unique constraint on email prevents saving duplicate emails."""
        User.ensure_indexes()

        u1 = User(email="duplicate@example.com", full_name="User One")
        u1.save()

        u2 = User(email="duplicate@example.com", full_name="User Two")
        with self.assertRaises(NotUniqueError):
            u2.save()

        # Different email succeeds
        u3 = User(email="different@example.com", full_name="User Three")
        u3.save()
        self.assertEqual(User.objects.count(), 2)

    def test_concurrent_duplicate_email_inserts(self):
        """Concurrent inserts with identical emails result in exactly 1 success."""
        User.ensure_indexes()
        results = []

        def worker(idx):
            try:
                User(email="concurrent@example.com", full_name=f"User {idx}").save()
                return "success"
            except NotUniqueError:
                return "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(worker, i) for i in range(8)]
            results = [f.result() for f in futures]

        self.assertEqual(results.count("success"), 1)
        self.assertEqual(results.count("duplicate"), 7)
        self.assertEqual(User.objects(email="concurrent@example.com").count(), 1)

    def test_password_hash_upgrade_saved_user(self):
        """check_password upgrades outdated hash and saves to DB when saved."""
        class OutdatedPBKDF2Hasher(PBKDF2PasswordHasher):
            iterations = 1000

        hasher = OutdatedPBKDF2Hasher()
        old_hash = hasher.encode("upgrade_me", salt="staticsalt")
        user = User(email="upgrade_saved@example.com", password_hash=old_hash).save()

        self.assertTrue(user.check_password("upgrade_me"))
        self.assertNotEqual(user.password_hash, old_hash)

        refreshed = User.objects(email="upgrade_saved@example.com").first()
        self.assertEqual(refreshed.password_hash, user.password_hash)
        self.assertNotEqual(refreshed.password_hash, old_hash)

    def test_password_hash_upgrade_unsaved_user(self):
        """check_password upgrades hash in-memory without error for unsaved user."""
        class OutdatedPBKDF2Hasher(PBKDF2PasswordHasher):
            iterations = 1000

        hasher = OutdatedPBKDF2Hasher()
        old_hash = hasher.encode("upgrade_unsaved", salt="staticsalt")
        user = User(email="upgrade_unsaved@example.com", password_hash=old_hash)

        self.assertIsNone(user.pk)
        self.assertTrue(user.check_password("upgrade_unsaved"))
        self.assertNotEqual(user.password_hash, old_hash)
        self.assertIsNone(user.pk)

    def test_password_hash_upgrade_with_dirty_unvalidated_fields(self):
        """check_password upgrades hash without triggering full document validation or saving dirty fields."""
        class OutdatedPBKDF2Hasher(PBKDF2PasswordHasher):
            iterations = 1000

        hasher = OutdatedPBKDF2Hasher()
        old_hash = hasher.encode("upgrade_dirty", salt="staticsalt")
        user = User(
            email="upgrade_dirty@example.com",
            role="attendee",
            full_name="Original Name",
            password_hash=old_hash,
        ).save()

        # Stage an invalid role and dirty name in memory before checking password
        user.role = "invalid_role_not_allowed"
        user.full_name = "Uncommitted Name"

        # check_password should succeed without raising ValidationError
        self.assertTrue(user.check_password("upgrade_dirty"))
        self.assertNotEqual(user.password_hash, old_hash)

        # In-memory user retains staged fields
        self.assertEqual(user.role, "invalid_role_not_allowed")
        self.assertEqual(user.full_name, "Uncommitted Name")

        # Database record has updated password_hash but original persisted fields are untouched
        refreshed = User.objects(email="upgrade_dirty@example.com").first()
        self.assertEqual(refreshed.password_hash, user.password_hash)
        self.assertEqual(refreshed.role, "attendee")
        self.assertEqual(refreshed.full_name, "Original Name")

    def test_password_hash_upgrade_unsaved_user_with_explicit_pk(self):
        """check_password upgrades hash in-memory only when document has pk but is not yet saved."""
        class OutdatedPBKDF2Hasher(PBKDF2PasswordHasher):
            iterations = 1000

        hasher = OutdatedPBKDF2Hasher()
        old_hash = hasher.encode("upgrade_explicit_pk", salt="staticsalt")
        user = User(
            id="123456789012345678901234",
            email="upgrade_explicit_pk@example.com",
            password_hash=old_hash,
        )

        self.assertIsNotNone(user.pk)
        self.assertTrue(user.check_password("upgrade_explicit_pk"))
        self.assertNotEqual(user.password_hash, old_hash)
        # Verify it was not inserted into the database
        self.assertIsNone(User.objects(email="upgrade_explicit_pk@example.com").first())

    def test_email_required_constraint(self):
        """User email is required."""
        u = User(full_name="No Email User")
        with self.assertRaises(ValidationError):
            u.save()

    def test_email_format_validation(self):
        """User rejects invalid email formats."""
        u = User(email="not-an-email-address")
        with self.assertRaises(ValidationError):
            u.validate()

    def test_role_choices(self):
        """Role must be one of: attendee, organizer, admin."""
        # Allowed roles
        for role in ["attendee", "organizer", "admin"]:
            u = User(email=f"{role}@example.com", role=role)
            u.validate()

        # Invalid roles
        for invalid_role in ["superuser", "guest", "root", "manager", ""]:
            u = User(email="test@example.com", role=invalid_role)
            with self.assertRaises(ValidationError):
                u.validate()

    def test_organizer_profile_embedding_validation(self):
        """Only OrganizerProfile or None can be embedded in organizer_profile."""
        u = User(email="test@example.com", role="organizer")
        u.organizer_profile = OrganizerProfile(name="Valid Profile")
        u.validate()

        # Non-embedded document assignment raises ValidationError
        u.organizer_profile = "invalid_string"  # type: ignore
        with self.assertRaises(ValidationError):
            u.validate()

    def test_password_hash_upgrade_with_db_connection_failure(self):
        """check_password succeeds even if MongoDB update fails during opportunistic hash upgrade."""
        class OutdatedPBKDF2Hasher(PBKDF2PasswordHasher):
            iterations = 1000

        hasher = OutdatedPBKDF2Hasher()
        old_hash = hasher.encode("upgrade_disconnect", salt="staticsalt")
        user = User(
            email="upgrade_disconnect@example.com",
            password_hash=old_hash,
        ).save()

        # Simulate database disconnection / transient connection failure
        mongoengine.disconnect_all()
        try:
            # check_password should still succeed (returns True) and upgrade in-memory hash
            self.assertTrue(user.check_password("upgrade_disconnect"))
            self.assertNotEqual(user.password_hash, old_hash)
        finally:
            # Reconnect test database for subsequent test cases
            mongoengine.connect(
                "test_marketplace_db",
                host="mongodb://localhost",
                mongo_client_class=mongomock.MongoClient,
                uuidRepresentation="standard",
            )

    def test_user_str(self):
        """__str__ returns user email or fallback."""
        user = User(email="str_test@example.com")
        self.assertEqual(str(user), "str_test@example.com")

        empty_user = User()
        self.assertEqual(str(empty_user), "User object")


class SystemLogModelTests(BaseMongoTestCase):
    """Unit tests for SystemLog Document (Requirement R3)."""

    def test_system_log_inheritance(self):
        """SystemLog must be a Document subclass."""
        self.assertTrue(issubclass(SystemLog, mongoengine.Document))

    def test_system_log_creation_and_save(self):
        """SystemLog persists all fields and can be queried."""
        log = SystemLog(
            level="ERROR",
            endpoint="/api/v1/checkout",
            method="POST",
            status_code=500,
            message="Payment gateway timeout",
            traceback="Traceback (most recent call last):\n  File 'views.py', line 42",
        )
        log.save()

        saved_log = SystemLog.objects(endpoint="/api/v1/checkout").first()
        self.assertIsNotNone(saved_log)
        self.assertEqual(saved_log.level, "ERROR")
        self.assertEqual(saved_log.method, "POST")
        self.assertEqual(saved_log.status_code, 500)
        self.assertEqual(saved_log.message, "Payment gateway timeout")
        self.assertIn("views.py", saved_log.traceback)
        self.assertIsInstance(saved_log.timestamp, datetime.datetime)

    def test_system_log_default_timestamp(self):
        """SystemLog automatically sets current timestamp when not provided."""
        before = datetime.datetime.now()
        log = SystemLog(level="INFO", message="Server started")
        log.save()
        after = datetime.datetime.now()

        self.assertIsNotNone(log.timestamp)
        self.assertIsInstance(log.timestamp, datetime.datetime)
        # Verify timestamp falls within creation window (with minor tolerance for clock resolution)
        self.assertGreaterEqual(log.timestamp, before - datetime.timedelta(seconds=1))
        self.assertLessEqual(log.timestamp, after + datetime.timedelta(seconds=1))

    def test_system_log_explicit_timestamp(self):
        """SystemLog preserves an explicitly provided timestamp."""
        custom_dt = datetime.datetime(2025, 1, 15, 10, 30, 0)
        log = SystemLog(
            level="WARNING",
            message="Custom time log",
            timestamp=custom_dt,
        )
        log.save()

        saved_log = SystemLog.objects(message="Custom time log").first()
        self.assertIsNotNone(saved_log)
        self.assertEqual(saved_log.timestamp, custom_dt)

    def test_system_log_status_code_validation(self):
        """SystemLog validates status_code as an integer."""
        log_valid = SystemLog(status_code=200)
        log_valid.validate()

        log_invalid = SystemLog(status_code="not_an_int")  # type: ignore
        with self.assertRaises(ValidationError):
            log_invalid.validate()

    def test_system_log_str(self):
        """SystemLog __str__ formats level, method, endpoint, and status code."""
        log = SystemLog(
            level="WARN",
            method="GET",
            endpoint="/api/v1/events",
            status_code=404,
        )
        self.assertEqual(str(log), "[WARN] GET /api/v1/events 404")

    def test_system_log_str_variations(self):
        """SystemLog __str__ formats various combinations cleanly without '[None]'."""
        # Empty log
        empty_log = SystemLog()
        self.assertNotIn("None", str(empty_log))

        # Only level
        level_log = SystemLog(level="INFO")
        self.assertEqual(str(level_log), "[INFO]")

        # Only message
        msg_log = SystemLog(message="Application started")
        self.assertEqual(str(msg_log), "Application started")

        # Level and message
        err_log = SystemLog(level="ERROR", message="Critical failure")
        self.assertEqual(str(err_log), "[ERROR] Critical failure")

        # Full endpoint info without level
        endpoint_log = SystemLog(method="POST", endpoint="/webhook", status_code=200)
        self.assertEqual(str(endpoint_log), "POST /webhook 200")

        # Level, HTTP info, and message combined
        full_log = SystemLog(
            level="ERROR",
            method="POST",
            endpoint="/api/checkout",
            status_code=500,
            message="Gateway timeout",
        )
        self.assertEqual(str(full_log), "[ERROR] POST /api/checkout 500 - Gateway timeout")


class ModelImportTests(unittest.TestCase):
    """Acceptance criteria: models.py successfully imports without errors."""

    def test_models_import_and_exports(self):
        """All required models can be imported from config.models and are in __all__."""
        import config.models as models_module

        self.assertTrue(hasattr(models_module, "OrganizerProfile"))
        self.assertTrue(hasattr(models_module, "User"))
        self.assertTrue(hasattr(models_module, "SystemLog"))
        self.assertIn("OrganizerProfile", models_module.__all__)
        self.assertIn("User", models_module.__all__)
        self.assertIn("SystemLog", models_module.__all__)

    def test_settings_import_with_preexisting_connection(self):
        """Importing settings does not raise ConnectionFailure when default connection is already registered."""
        import importlib
        import config.settings

        # Re-importing or reloading settings should not raise ConnectionFailure
        importlib.reload(config.settings)

    def test_ensure_django_settings_with_fallback_secret_key(self):
        """_ensure_django_settings provides a valid SECRET_KEY preventing ImproperlyConfigured."""
        from django.conf import settings
        from config.models import _ensure_django_settings

        _ensure_django_settings()
        self.assertTrue(settings.configured)
        self.assertTrue(bool(settings.SECRET_KEY))

