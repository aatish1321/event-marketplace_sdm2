"""Persist unhandled view exceptions without changing Django error handling."""

import logging
import traceback

from django.utils.deprecation import MiddlewareMixin

from .models import SystemLog


logger = logging.getLogger(__name__)


class MongoExceptionLoggingMiddleware(MiddlewareMixin):
    def process_exception(self, request, exception):
        try:
            SystemLog(
                level="ERROR",
                endpoint=request.path,
                method=request.method,
                status_code=500,
                message=str(exception),
                traceback=traceback.format_exc(),
            ).save()
        except Exception:
            # A database outage must not replace the original view exception.
            logger.exception("Failed to persist exception to SystemLog.")
        return None
