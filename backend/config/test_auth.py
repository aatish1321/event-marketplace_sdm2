"""Endpoint regression tests using the project's in-memory MongoDB fixture."""

import json
from datetime import datetime, timezone
from unittest.mock import patch

import jwt
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.test import Client, override_settings

from config.models import User
from config.tests import BaseMongoTestCase


class AuthViewsTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(override_settings(
            ALLOWED_HOSTS=["testserver"],
            SECRET_KEY="auth-tests-only-signing-key-at-least-32-bytes",
        ))
        self.client = Client(enforce_csrf_checks=True)
        self.registration = {
            "email": "attendee@example.com",
            "password": "A strong password 123!",
            "full_name": "Test Attendee",
            "role": "attendee",
        }
        self.profile = {
            "name": "Example Events",
            "contact_email": "contact@example.com",
            "organization_id": "org-123",
        }

    def post(self, endpoint, data):
        return self.client.post(f"/api/auth/{endpoint}/", data, content_type="application/json")

    def create_user(self, role="attendee"):
        user = User(email=self.registration["email"], full_name="Test Attendee", role=role)
        user.set_password(self.registration["password"])
        user.save()
        return user

    def test_register_attendee_hashes_password_without_session(self):
        response = self.post("register", self.registration)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email=self.registration["email"])
        self.assertEqual(response.json(), {
            "user_id": str(user.id), "email": user.email,
            "full_name": user.full_name, "role": user.role,
        })
        self.assertNotEqual(user.password_hash, self.registration["password"])
        self.assertTrue(user.check_password(self.registration["password"]))
        self.assertIsNone(user.organizer_profile)
        self.assertFalse(response.cookies)

    def test_register_organizer_persists_embedded_profile(self):
        data = {**self.registration, "role": "organizer", "organizer_profile": self.profile}
        response = self.post("register", data)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(id=response.json()["user_id"])
        self.assertEqual(user.role, "organizer")
        self.assertEqual(user.organizer_profile.to_mongo().to_dict(), self.profile)

    def test_register_requires_each_field_as_nonempty_string(self):
        for field in self.registration:
            missing = {key: value for key, value in self.registration.items() if key != field}
            with self.subTest(field=field, missing=True):
                self.assertEqual(self.post("register", missing).status_code, 400)
            for value in (None, "", " ", 123, [], {}, True):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.post("register", {**self.registration, field: value}).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_register_rejects_invalid_email_and_roles(self):
        for changes in ({"email": "not-an-email"}, {"role": "admin"}, {"role": "guest"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.post("register", {**self.registration, **changes}).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_register_requires_organizer_profile_object(self):
        data = {**self.registration, "role": "organizer"}
        self.assertEqual(self.post("register", data).status_code, 400)
        for value in (None, "", [], 42, True, {}):
            with self.subTest(value=value):
                self.assertEqual(self.post("register", {**data, "organizer_profile": value}).status_code, 400)

    def test_register_requires_all_organizer_fields(self):
        for field in self.profile:
            missing = {key: value for key, value in self.profile.items() if key != field}
            for profile in [missing] + [{**self.profile, field: value} for value in (None, "", " ", 42, [], {})]:
                with self.subTest(field=field, profile=profile):
                    data = {**self.registration, "role": "organizer", "organizer_profile": profile}
                    self.assertEqual(self.post("register", data).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_register_validates_organizer_email(self):
        data = {**self.registration, "role": "organizer", "organizer_profile": {**self.profile, "contact_email": "invalid"}}
        self.assertEqual(self.post("register", data).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_duplicate_email_returns_conflict_and_preserves_account(self):
        user = self.create_user()
        response = self.post("register", {**self.registration, "password": "replacement"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(User.objects.count(), 1)
        user.reload()
        self.assertTrue(user.check_password(self.registration["password"]))

    def test_register_ignores_untrusted_id_and_hash(self):
        response = self.post("register", {**self.registration, "id": "123456789012345678901234", "password_hash": "attacker-chosen"})
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(id=response.json()["user_id"])
        self.assertNotEqual(str(user.id), "123456789012345678901234")
        self.assertTrue(user.check_password(self.registration["password"]))

    def test_invalid_json_returns_400_for_both_endpoints(self):
        bodies = [b"", b"{", b'{"email":}', b'{"email":"\xff"}', b"[1,2]", b"null", b"true", b"42", b'"text"', b"[" * 2000]
        for endpoint in ("register", "login"):
            for body in bodies:
                with self.subTest(endpoint=endpoint, body=body[:40]):
                    response = self.client.post(f"/api/auth/{endpoint}/", body, content_type="application/json")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("error", response.json())
        self.assertEqual(User.objects.count(), 0)

    def test_only_post_is_allowed(self):
        for endpoint in ("register", "login"):
            for method in ("get", "put", "patch", "delete", "head", "options"):
                with self.subTest(endpoint=endpoint, method=method):
                    response = getattr(self.client, method)(f"/api/auth/{endpoint}/")
                    self.assertEqual(response.status_code, 405)
                    self.assertEqual(response["Allow"], "POST")

    def test_login_returns_verifiable_expiring_jwt_without_session(self):
        self.assertEqual(self.post("register", self.registration).status_code, 201)
        user = User.objects.get(email=self.registration["email"])
        # The token role must come from storage, never from the login request.
        response = self.post("login", {**self.registration, "role": "admin"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        claims = jwt.decode(body["token"], settings.SECRET_KEY, algorithms=["HS256"], options={"require": ["user_id", "role", "iat", "exp"]})
        self.assertEqual(claims["user_id"], str(user.id))
        self.assertEqual(claims["role"], "attendee")
        self.assertEqual(claims["exp"] - claims["iat"], 3600)
        self.assertGreater(claims["exp"], datetime.now(timezone.utc).timestamp())
        self.assertEqual(body["expires_in"], 3600)
        self.assertEqual(body["token_type"], "Bearer")
        self.assertFalse(response.cookies)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertNotIn("password", json.dumps(claims))
        with self.assertRaises(jwt.InvalidSignatureError):
            jwt.decode(body["token"], "different-tests-only-signing-key-at-least-32-bytes", algorithms=["HS256"])

    def test_existing_organizers_and_admins_can_log_in(self):
        user = self.create_user()
        for role in ("organizer", "admin"):
            user.update(set__role=role)
            response = self.post("login", self.registration)
            self.assertEqual(response.status_code, 200)
            claims = jwt.decode(response.json()["token"], settings.SECRET_KEY, algorithms=["HS256"])
            self.assertEqual(claims["role"], role)

    def test_invalid_credentials_have_same_generic_response(self):
        self.create_user()
        wrong_password = self.post("login", {**self.registration, "password": "wrong"})
        with patch("config.auth_views.make_password", wraps=make_password) as dummy_hash:
            unknown_email = self.post("login", {**self.registration, "email": "missing@example.com"})
        dummy_hash.assert_called_once_with(self.registration["password"])
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(wrong_password.json(), unknown_email.json())
        self.assertNotIn("token", wrong_password.json())

    def test_unusable_password_cannot_log_in(self):
        user = self.create_user()
        user.set_unusable_password()
        user.save()
        self.assertEqual(self.post("login", self.registration).status_code, 401)

    def test_login_requires_string_credentials(self):
        for field in ("email", "password"):
            missing = {key: value for key, value in self.registration.items() if key != field}
            self.assertEqual(self.post("login", missing).status_code, 400)
            for value in (None, "", " ", 42, [], {}, True):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.post("login", {**self.registration, field: value}).status_code, 400)

    def test_password_whitespace_and_unicode_are_preserved(self):
        data = {**self.registration, "password": "  pàsswörd 🔒  "}
        self.assertEqual(self.post("register", data).status_code, 201)
        self.assertEqual(self.post("login", data).status_code, 200)
        self.assertEqual(self.post("login", {**data, "password": data["password"].strip()}).status_code, 401)
