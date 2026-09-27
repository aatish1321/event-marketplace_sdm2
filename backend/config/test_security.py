"""Route authorization and exception logging regression tests."""

import json
import time
import unittest
from unittest.mock import Mock, patch

import jwt
from django.conf import settings
from django.http import JsonResponse
from django.test import Client, RequestFactory, override_settings
from django.urls import path

from config.tests import BaseMongoTestCase
from config.decorators import require_role
from config.middleware import MongoExceptionLoggingMiddleware
from config.models import SystemLog, User
from config.urls import urlpatterns as application_urls


@require_role(["admin"])
def protected_view(request):
    return JsonResponse({"user_id": request.jwt_payload["user_id"]})


def broken_view(request):
    raise RuntimeError("view exploded")


urlpatterns = application_urls + [
    path("security/protected/", protected_view),
    path("security/broken/", broken_view),
]


class RequireRoleTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(override_settings(
            SECRET_KEY="security-tests-signing-secret-at-least-32-bytes",
        ))
        self.factory = RequestFactory()
        self.payload = {
            "user_id": "stateless-user-id", "role": "admin",
            "iat": int(time.time()) - 10, "exp": int(time.time()) + 3600,
        }
        self.view = Mock(return_value=JsonResponse({"ok": True}))
        self.guarded = require_role(["admin", "organizer"])(self.view)

    def token(self, payload=None, **kwargs):
        return jwt.encode(
            self.payload if payload is None else payload,
            kwargs.pop("key", settings.SECRET_KEY),
            algorithm=kwargs.pop("algorithm", "HS256"), **kwargs,
        )

    def request(self, token):
        return self.factory.get("/protected/", HTTP_AUTHORIZATION=f"Bearer {token}")

    def assert_forbidden(self, response):
        self.assertEqual(response.status_code, 403)
        self.assertEqual(json.loads(response.content), {"error": "Forbidden."})
        self.view.assert_not_called()

    def test_allowed_roles_attach_verified_payload_and_forward_arguments(self):
        for role in ("admin", "organizer"):
            with self.subTest(role=role):
                payload = {**self.payload, "role": role}
                request = self.request(self.token(payload))
                self.assertEqual(self.guarded(request, 7, event_id="42").status_code, 200)
                self.assertEqual(request.jwt_payload, payload)
                self.view.assert_called_with(request, 7, event_id="42")

    def test_single_string_role_and_case_insensitive_bearer(self):
        request = self.factory.get("/", HTTP_AUTHORIZATION=f"bEaReR {self.token()}")
        self.assertEqual(require_role("admin")(self.view)(request).status_code, 200)

    def test_preserves_view_metadata(self):
        def original(request):
            """Original view documentation."""
        decorated = require_role("admin")(original)
        self.assertEqual(decorated.__name__, original.__name__)
        self.assertEqual(decorated.__doc__, original.__doc__)
        self.assertIs(decorated.__wrapped__, original)

    def test_missing_and_malformed_authorization_headers(self):
        for header in (None, "", "Bearer", "Bearer ", self.token(),
                       f"Basic {self.token()}", f"Bearer {self.token()} extra",
                       "Bearer not.a.jwt"):
            with self.subTest(header=header):
                kwargs = {} if header is None else {"HTTP_AUTHORIZATION": header}
                self.assert_forbidden(self.guarded(self.factory.get("/", **kwargs)))

    def test_disallowed_role_and_empty_allowlist(self):
        self.assert_forbidden(self.guarded(self.request(self.token({**self.payload, "role": "attendee"}))))
        self.assert_forbidden(require_role([])(self.view)(self.request(self.token())))

    def test_invalid_role_configuration(self):
        for roles in (None, 42, [None], ["superuser"], ["admin", []], ""):
            with self.subTest(roles=roles), self.assertRaises(ValueError):
                require_role(roles)

    def test_required_claims(self):
        for claim in self.payload:
            with self.subTest(claim=claim):
                payload = dict(self.payload)
                del payload[claim]
                self.assert_forbidden(self.guarded(self.request(self.token(payload))))

    def test_invalid_identity_and_role_claim_types(self):
        for claim, values in (("user_id", [None, "", "   ", 1, [], {}]),
                              ("role", [None, "", "superuser", 1, [], {}])):
            for value in values:
                with self.subTest(claim=claim, value=value):
                    self.assert_forbidden(self.guarded(self.request(self.token({**self.payload, claim: value}))))

    def test_invalid_temporal_claim_types(self):
        for claim in ("iat", "exp"):
            for value in (None, True, False, "2000000000", [], {}, float("inf"), float("-inf"), float("nan")):
                with self.subTest(claim=claim, value=value):
                    self.assert_forbidden(self.guarded(self.request(self.token({**self.payload, claim: value}))))

    def test_expired_and_premature_tokens(self):
        for changes in ({"exp": int(time.time()) - 60},
                        {"iat": int(time.time()) + 3600},
                        {"nbf": int(time.time()) + 3600}):
            with self.subTest(changes=changes):
                self.assert_forbidden(self.guarded(self.request(self.token({**self.payload, **changes}))))

    def test_wrong_signature_algorithm_and_unsigned_tokens(self):
        tokens = [self.token(key="wrong-secret-that-is-at-least-32-bytes"),
                  self.token(algorithm="HS384"),
                  self.token(key="", algorithm="none")]
        for token in tokens:
            with self.subTest(token=token):
                self.assert_forbidden(self.guarded(self.request(token)))

    def test_authorized_view_errors_propagate(self):
        self.view.side_effect = ValueError("application failure")
        with self.assertRaisesRegex(ValueError, "application failure"):
            self.guarded(self.request(self.token()))


class SecurityIntegrationTests(BaseMongoTestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(override_settings(
            ROOT_URLCONF=__name__, ALLOWED_HOSTS=["testserver"], DEBUG=False,
            SECRET_KEY="security-tests-signing-secret-at-least-32-bytes",
        ))
        self.client = Client()

    def test_login_token_authorizes_admin_without_user_lookup(self):
        user = User(email="admin@example.com", role="admin")
        user.set_password("test-password")
        user.save()
        response = self.client.post("/api/auth/login/", {
            "email": user.email, "password": "test-password",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]
        user_id = str(user.id)
        user.delete()
        response = self.client.get("/security/protected/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"user_id": user_id})

    def test_unhandled_view_exception_is_logged_by_registered_middleware(self):
        with self.assertRaisesRegex(RuntimeError, "view exploded"):
            self.client.get("/security/broken/?sensitive=value")
        self.assertEqual(SystemLog.objects.count(), 1)
        log = SystemLog.objects.first()
        self.assertEqual(log.level, "ERROR")
        self.assertEqual(log.endpoint, "/security/broken/")
        self.assertEqual(log.method, "GET")
        self.assertEqual(log.status_code, 500)
        self.assertEqual(log.message, "view exploded")
        self.assertIn("Traceback (most recent call last)", log.traceback)
        self.assertIn("RuntimeError: view exploded", log.traceback)

    def test_normal_and_forbidden_responses_do_not_create_error_logs(self):
        self.assertEqual(self.client.get("/security/protected/").status_code, 403)
        self.assertEqual(SystemLog.objects.count(), 0)

    def test_process_exception_returns_none_after_persisting_traceback(self):
        middleware = MongoExceptionLoggingMiddleware(lambda request: None)
        try:
            raise ValueError("direct failure")
        except ValueError as exc:
            result = middleware.process_exception(RequestFactory().post("/checkout/"), exc)
        self.assertIsNone(result)
        log = SystemLog.objects.get()
        self.assertEqual(log.method, "POST")
        self.assertIn("ValueError: direct failure", log.traceback)

    def test_logging_failure_does_not_replace_original_view_error(self):
        with patch("config.middleware.SystemLog.save", side_effect=RuntimeError("database unavailable")), patch("config.middleware.logger.exception") as fallback:
            with self.assertRaisesRegex(RuntimeError, "view exploded"):
                self.client.get("/security/broken/")
        fallback.assert_called_once()
        self.assertEqual(SystemLog.objects.count(), 0)
