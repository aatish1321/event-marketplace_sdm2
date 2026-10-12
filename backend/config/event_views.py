"""JSON event CRUD with JWT organizer ownership on mutations."""

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from mongoengine.errors import ValidationError

from .auth_views import _read_json, _required_string
from .decorators import require_role
from .models import Event, OnlineEvent, PhysicalEvent, User


EVENT_TYPES = {"event": Event, "physical": PhysicalEvent, "online": OnlineEvent}
COMMON_FIELDS = ("title", "status", "continent", "country", "available_tickets")
TYPE_FIELDS = {Event: (), PhysicalEvent: ("venue_name", "address"), OnlineEvent: ("stream_url",)}


def _serialize_event(event):
    return {
        "id": str(event.id),
        "organizer_id": event.organizer_id,
        "event_type": next(name for name, model in EVENT_TYPES.items() if type(event) is model),
        **{field: getattr(event, field) for field in COMMON_FIELDS + TYPE_FIELDS[type(event)]},
    }


def _event_fields(data, model, creating=False):
    fields = COMMON_FIELDS + TYPE_FIELDS[model]
    if set(data) - set(fields) - {"event_type", "organizer_id"}:
        raise ValueError("Unknown event fields.")
    values = {field: data[field] for field in fields if field in data}
    required = ("title",) + TYPE_FIELDS[model]
    for field in fields:
        if field not in values and not (creating and field in required):
            continue
        if field in required:
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
        event.save()
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    except ValidationError as exc:
        return JsonResponse({"error": "Invalid event data.", "fields": exc.to_dict()}, status=400)
    return JsonResponse(_serialize_event(event), status=201)


def _find_event(event_id):
    try:
        return Event.objects(id=event_id).first()
    except ValidationError:
        return None


@require_role(User.ROLE_ORGANIZER)
def _mutate_event(request, event_id):
    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    if event.organizer_id != request.jwt_payload["user_id"]:
        return JsonResponse({"error": "Forbidden."}, status=403)
    if request.method == "DELETE":
        event.delete()
        return HttpResponse(status=204)
    try:
        data = _read_json(request)
        if "event_type" in data and data["event_type"] != _serialize_event(event)["event_type"]:
            raise ValueError("event_type cannot be changed.")
        for field, value in _event_fields(data, type(event)).items():
            setattr(event, field, value)
        event.save()
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)
    except ValidationError as exc:
        return JsonResponse({"error": "Invalid event data.", "fields": exc.to_dict()}, status=400)
    return JsonResponse(_serialize_event(event))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def events(request):
    if request.method == "POST":
        return _create_event(request)
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
