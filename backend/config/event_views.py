"""JSON event CRUD with JWT organizer ownership on mutations."""

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from django.http import HttpResponse, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from mongoengine.errors import ValidationError

from .auth_views import _read_json, _required_string
from .decorators import require_role
from .models import CURRENCIES, MAX_SAFE_AMOUNT, MAX_COVER_BYTES, Event, EventCover, OnlineEvent, PhysicalEvent, User


EVENT_TYPES = {"event": Event, "physical": PhysicalEvent, "online": OnlineEvent}
COMMON_FIELDS = ("title", "status", "continent", "country", "available_tickets", "description", "ticket_price_minor", "currency")
DATE_FIELDS = ("start_at", "end_at")
TYPE_FIELDS = {Event: (), PhysicalEvent: ("venue_name", "address"), OnlineEvent: ("stream_url",)}
OPTIONAL_FIELDS = {Event: (), PhysicalEvent: ("location",), OnlineEvent: ()}


def _as_utc(value):
    # MongoDB normally restores UTC dates without timezone information.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso_date(value):
    return _as_utc(value).isoformat().replace("+00:00", "Z") if value else None


def _validate_schedule(event):
    if (event.start_at is None) != (event.end_at is None):
        raise ValueError("Provide both start_at and end_at.")
    if event.start_at is not None and _as_utc(event.end_at) <= _as_utc(event.start_at):
        raise ValueError("end_at must be after start_at.")


def _cover_url(event):
    if event.cover_updated_at is None:
        return None
    # The version query busts caches when the photo is replaced.
    version = int(_as_utc(event.cover_updated_at).timestamp() * 1000)
    return f"/api/events/{event.id}/cover/?v={version}"


def _serialize_event(event):
    return {
        "id": str(event.id),
        "organizer_id": event.organizer_id,
        "event_type": next(name for name, model in EVENT_TYPES.items() if type(event) is model),
        **{field: getattr(event, field) for field in COMMON_FIELDS + TYPE_FIELDS[type(event)] + OPTIONAL_FIELDS[type(event)]},
        **{field: _iso_date(getattr(event, field)) for field in DATE_FIELDS + ("created_at",)},
        "cover_url": _cover_url(event),
    }


def _event_fields(data, model, creating=False):
    fields = COMMON_FIELDS + DATE_FIELDS + TYPE_FIELDS[model] + OPTIONAL_FIELDS[model]
    if set(data) - set(fields) - {"event_type", "organizer_id"}:
        raise ValueError("Unknown event fields.")
    values = {field: data[field] for field in fields if field in data}
    required = ("title",) + TYPE_FIELDS[model]
    for field in fields:
        if field not in values and not (creating and field in required):
            continue
        if field in DATE_FIELDS:
            raw = values[field]
            if not isinstance(raw, str) or len(raw) > 64:
                raise ValueError("Dates must be timezone-aware ISO8601 strings.")
            try:
                date = datetime.fromisoformat(raw)
                if date.tzinfo is None or date.utcoffset() is None:
                    raise ValueError("Date timezone is required.")
                values[field] = date.astimezone(timezone.utc)
            except (ValueError, OverflowError) as exc:
                raise ValueError("Invalid date.") from exc
        elif field == "ticket_price_minor":
            value = values[field]
            if value is not None and (type(value) is not int or not 0 <= value <= MAX_SAFE_AMOUNT):
                raise ValueError("ticket_price_minor must be a non-negative safe integer.")
        elif field == "currency":
            value = values[field]
            if value is not None and (not isinstance(value, str) or value not in CURRENCIES):
                raise ValueError("Unsupported currency.")
        elif field == "location":
            # PointField validates the GeoJSON shape, numeric types and ranges.
            continue
        elif field in required:
            values[field] = _required_string(data, field)
        elif field == "available_tickets":
            if type(values[field]) is not int or not 0 <= values[field] <= 2**63 - 1:
                raise ValueError("available_tickets must be a non-negative BSON integer.")
        elif not isinstance(values[field], str):
            raise ValueError(f"{field} must be a string.")
    return values


@require_role(User.ROLE_ORGANIZER)
def _create_event(request):
    try:
        data = _read_json(request)
        event_type = data.get("event_type", "event")
        if not isinstance(event_type, str) or event_type not in EVENT_TYPES:
            raise ValueError("Invalid event_type.")
        model = EVENT_TYPES[event_type]
        event = model(
            organizer_id=request.jwt_payload["user_id"],
            **_event_fields(data, model, creating=True),
        )
        _validate_schedule(event)
        event.save()
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    except ValidationError as exc:
        return JsonResponse({"error": "Invalid event data.", "fields": exc.to_dict()}, status=400)
    return JsonResponse(_serialize_event(event), status=201)


def _find_event(event_id):
    if not isinstance(event_id, str):
        return None
    try:
        return Event.objects(id=ObjectId(event_id)).first()
    except (InvalidId, ValidationError):
        return None


@require_role(User.ROLE_ORGANIZER)
def _mutate_event(request, event_id):
    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    if event.organizer_id != request.jwt_payload["user_id"]:
        return JsonResponse({"error": "Forbidden."}, status=403)
    if request.method == "DELETE":
        EventCover.objects(event_id=str(event.id)).delete()
        event.delete()
        return HttpResponse(status=204)
    try:
        data = _read_json(request)
        if "event_type" in data and data["event_type"] != _serialize_event(event)["event_type"]:
            raise ValueError("event_type cannot be changed.")
        for field, value in _event_fields(data, type(event)).items():
            setattr(event, field, value)
        _validate_schedule(event)
        event.save()
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    except ValidationError as exc:
        return JsonResponse({"error": "Invalid event data.", "fields": exc.to_dict()}, status=400)
    return JsonResponse(_serialize_event(event))


@never_cache
@require_role(User.ROLE_ORGANIZER)
def _organizer_events(request):
    owned = Event.objects(organizer_id=request.jwt_payload["user_id"]).order_by("start_at", "id")
    return JsonResponse([_serialize_event(event) for event in owned], safe=False)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def events(request):
    if request.method == "POST":
        return _create_event(request)
    if "mine" in request.GET:
        if request.GET.getlist("mine") != ["1"]:
            return JsonResponse({"error": "mine must be 1."}, status=400)
        return _organizer_events(request)
    return JsonResponse([_serialize_event(event) for event in Event.objects], safe=False)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def event_detail(request, event_id):
    if request.method != "GET":
        return _mutate_event(request, event_id)
    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    return JsonResponse(_serialize_event(event))


def _image_type(data):
    """Identify JPEG, PNG or WebP from the file's own bytes; the client's Content-Type is never trusted."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@require_role(User.ROLE_ORGANIZER)
def _put_cover(request, event_id):
    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    if event.organizer_id != request.jwt_payload["user_id"]:
        return JsonResponse({"error": "Forbidden."}, status=403)
    try:
        declared = int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    too_large = JsonResponse({"error": "Cover photo must be 2 MB or smaller."}, status=413)
    if declared > MAX_COVER_BYTES:
        return too_large
    data = request.read(MAX_COVER_BYTES + 1)  # bounded read: never buffers more than the limit
    if len(data) > MAX_COVER_BYTES:
        return too_large
    content_type = _image_type(data)
    if content_type is None:
        return JsonResponse({"error": "Cover photo must be a JPEG, PNG or WebP image."}, status=400)
    EventCover.objects(event_id=str(event.id)).update_one(
        set__content_type=content_type, set__data=data, upsert=True)
    # Mongo keeps milliseconds, so keep the cache-busting version strictly increasing per event.
    now = datetime.now(timezone.utc)
    now = now.replace(microsecond=now.microsecond // 1000 * 1000)
    if event.cover_updated_at is not None and now <= _as_utc(event.cover_updated_at):
        now = _as_utc(event.cover_updated_at) + timedelta(milliseconds=1)
    event.cover_updated_at = now
    # Targeted update: a full save() could overwrite a ticket count changed by a concurrent purchase.
    Event.objects(id=event.id).update_one(set__cover_updated_at=event.cover_updated_at)
    return JsonResponse(_serialize_event(event))


def _get_cover(request, event_id):
    event = _find_event(event_id)
    cover = EventCover.objects(event_id=str(event.id)).first() if event else None
    if cover is None:
        return JsonResponse({"error": "Cover not found."}, status=404)
    response = HttpResponse(bytes(cover.data), content_type=cover.content_type)
    response["Cache-Control"] = "public, max-age=3600"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'"
    return response


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def event_cover(request, event_id):
    return _put_cover(request, event_id) if request.method == "PUT" else _get_cover(request, event_id)
