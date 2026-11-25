"""Production configuration must fail closed without explicit hostnames."""

import importlib
import os
import sys
import unittest
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured


class ProductionSettingsTests(unittest.TestCase):
    def load(self, hosts, trust_proxy="False"):
        sys.modules.pop("config.production", None)
        self.addCleanup(sys.modules.pop, "config.production", None)
        with patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": hosts, "DJANGO_TRUST_PROXY": trust_proxy}):
            return importlib.import_module("config.production")

    def test_missing_or_wildcard_hosts_are_rejected(self):
        for hosts in ("", "*"):
            with self.subTest(hosts=hosts), self.assertRaises(ImproperlyConfigured):
                self.load(hosts)

    def test_explicit_hosts_disable_debug_and_require_https(self):
        settings = self.load("events.example.com")
        self.assertEqual(settings.ALLOWED_HOSTS, ["events.example.com"])
        self.assertFalse(settings.DEBUG)
        self.assertTrue(settings.SECURE_SSL_REDIRECT)
        self.assertTrue(settings.CSRF_COOKIE_SECURE)
        self.assertFalse(hasattr(settings, "SECURE_PROXY_SSL_HEADER"))
        settings = self.load("events.example.com", "True")
        self.assertEqual(settings.SECURE_PROXY_SSL_HEADER, ("HTTP_X_FORWARDED_PROTO", "https"))
