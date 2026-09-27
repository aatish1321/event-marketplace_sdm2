"""Stateless JSON registration and login for MongoEngine users."""

import json
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from mongoengine.errors import NotUniqueError, ValidationError

from .models import OrganizerProfile, User


TOKEN_LIFETIME_SECONDS = 3600


def _read_json(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, RecursionError) as exc:
        raise ValueError("Request body must be a valid UTF-8 JSON object.") from exc
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")
    return data


def _required_string(data, field):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string.")
    return value


# These endpoints use credentials in the body and return bearer tokens; they do
# not authenticate through cookies or create Django sessions.
@csrf_exempt
@require_POST
def register(request):
    try:
        data = _read_json(request)
        email = _required_string(data, "email").strip()
        password = _required_string(data, "password")
        full_name = _required_string(data, "full_name").strip()
        role = _required_string(data, "role")
        if role not in (User.ROLE_ATTENDEE, User.ROLE_ORGANIZER):
            raise ValueError("Public registration allows attendee or organizer roles only.")

        profile = None
        if role == User.ROLE_ORGANIZER:
            profile_data = data.get("organizer_profile")
            if not isinstance(profile_data, dict):
                raise ValueError("organizer_profile must be a JSON object for organizers.")
            profile = OrganizerProfile(
                name=_required_string(profile_data, "name").strip(),
                contact_email=_required_string(profile_data, "contact_email").strip(),
                organization_id=_required_string(profile_data, "organization_id").strip(),
            )

        user = User(
            email=email, full_name=full_name, role=role, organizer_profile=profile
        )
        user.validate()
    except ValueError as exc:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    except ValidationError as exc:
        return JsonResponse({"error": "Invalid registration data.", "fields": exc.to_dict()}, status=400)

    user.set_password(password)
    try:
        user.save()
    except NotUniqueError:
        return JsonResponse({"error": "An account with this email already exists."}, status=409)

    return JsonResponse(
        {
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
        status=201,
    )


@csrf_exempt
@require_POST
def login(request):
    try:
        data = _read_json(request)
        email = _required_string(data, "email").strip()
        password = _required_string(data, "password")
    except ValueError as exc:
        return JsonResponse({"error": "Invalid request payload."}, status=400)

    user = User.objects(email=str(email)).first()
    if user is None:
        # Match the password-hashing work of an unsuccessful existing-user login.
        make_password(password)
        return JsonResponse({"error": "Invalid email or password."}, status=401)
    if not user.check_password(password):
        return JsonResponse({"error": "Invalid email or password."}, status=401)

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "user_id": str(user.id),
            "role": user.role,
            "iat": now,
            "exp": now + timedelta(seconds=TOKEN_LIFETIME_SECONDS),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    response = JsonResponse(
        {"token": token, "token_type": "Bearer", "expires_in": TOKEN_LIFETIME_SECONDS}
    )
    response["Cache-Control"] = "no-store"
    return response
