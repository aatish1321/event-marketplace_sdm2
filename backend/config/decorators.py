"""Role guards for the application's stateless bearer tokens."""

from functools import wraps
import math

import jwt
from django.conf import settings
from django.http import JsonResponse

from .models import User


def require_role(allowed_roles):
    """Require a signed login token with an allowed role; expose jwt_payload."""
    if isinstance(allowed_roles, str):
        allowed_roles = (allowed_roles,)
    try:
        roles = frozenset(allowed_roles)
    except TypeError as exc:
        raise ValueError("allowed_roles must contain valid user roles.") from exc
    if not roles.issubset(User.ROLE_CHOICES):
        raise ValueError("allowed_roles must contain valid user roles.")

    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            parts = request.headers.get("Authorization", "").split()
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return JsonResponse({"error": "Forbidden."}, status=403)
            try:
                payload = jwt.decode(
                    parts[1],
                    settings.SECRET_KEY,
                    algorithms=["HS256"],
                    options={"require": ["user_id", "role", "iat", "exp"]},
                )
                if (
                    not isinstance(payload["user_id"], str)
                    or not payload["user_id"].strip()
                    or not isinstance(payload["role"], str)
                    or payload["role"] not in roles
                    or any(
                        isinstance(payload[name], bool)
                        or not isinstance(payload[name], (int, float))
                        or not math.isfinite(payload[name])
                        for name in ("iat", "exp")
                    )
                ):
                    return JsonResponse({"error": "Forbidden."}, status=403)
            except (jwt.InvalidTokenError, TypeError, ValueError, OverflowError):
                return JsonResponse({"error": "Forbidden."}, status=403)
            request.jwt_payload = payload
            return view(request, *args, **kwargs)

        return wrapped

    return decorator
