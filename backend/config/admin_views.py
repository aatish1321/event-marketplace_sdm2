"""Admin-only logs, account suspension, and event moderation."""

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_PUT

from .decorators import require_role
from .auth_views import _read_json
from .event_views import _find_event, _iso_date, _serialize_event
from .models import AccountAccess, Event, SystemLog, User
from bson import ObjectId


LOG_FIELDS = ("level", "endpoint", "method", "status_code", "message", "traceback")


def _bounded_int(query, name, default, low, high):
    raw = query.get(name, default)
    if len(query.getlist(name)) > 1 or not raw.isascii() or not raw.isdecimal() or not low <= int(raw) <= high:
        raise ValueError(f"{name} must be an integer from {low} to {high}.")
    return int(raw)


@never_cache
@require_GET
@require_role(["admin"])
def system_logs(request):
    try:
        limit = _bounded_int(request.GET, "limit", "20", 1, 100)
        offset = _bounded_int(request.GET, "offset", "0", 0, 2**31 - 1)
    except ValueError:
        return JsonResponse({"error": "Invalid request parameters."}, status=400)
    logs = SystemLog.objects.order_by("-timestamp", "-id")
    return JsonResponse({
        "count": logs.count(),
        "limit": limit,
        "offset": offset,
        "results": [
            {
                "id": str(log.id),
                **{field: getattr(log, field) for field in LOG_FIELDS},
                "timestamp": _iso_date(log.timestamp),
            }
            for log in logs.skip(offset).limit(limit)
        ],
    })


def _page(query, params, serialize):
    limit = _bounded_int(params, "limit", "20", 1, 100)
    offset = _bounded_int(params, "offset", "0", 0, 100000)
    return {"count": query.count(), "limit": limit, "offset": offset,
            "results": [serialize(item) for item in query.skip(offset).limit(limit)]}


@never_cache
@require_GET
@require_role(User.ROLE_ADMIN)
def users(request):
    inactive = set(AccountAccess.objects(active=False).scalar("user_id"))
    try:
        data = _page(User.objects.order_by("email", "id"), request.GET, lambda user: {
            "id": str(user.id), "email": user.email, "full_name": user.full_name,
            "role": user.role, "active": str(user.id) not in inactive,
        })
    except ValueError:
        return JsonResponse({"error": "Invalid pagination."}, status=400)
    return JsonResponse(data)


@csrf_exempt
@never_cache
@require_PUT
@require_role(User.ROLE_ADMIN)
def user_access(request, user_id):
    user = User.objects(id=ObjectId(user_id)).first() if ObjectId.is_valid(user_id) else None
    if user is None:
        return JsonResponse({"error": "Account not found."}, status=404)
    user_id = str(user.id)
    # No admin suspension here: avoid locking the installation out of administration.
    if user.role == User.ROLE_ADMIN:
        return JsonResponse({"error": "Admin accounts cannot be suspended here."}, status=409)
    try:
        data = _read_json(request)
        if set(data) != {"active"} or type(data["active"]) is not bool:
            raise ValueError("active must be a boolean.")
    except ValueError:
        return JsonResponse({"error": "Provide active as a boolean."}, status=400)
    AccountAccess.objects(user_id=user_id).update_one(set__active=data["active"], inc__version=1, upsert=True)
    return JsonResponse({"id": user_id, "active": data["active"]})


@never_cache
@require_GET
@require_role(User.ROLE_ADMIN)
def events(request):
    try:
        data = _page(Event.objects.order_by("-created_at", "-id"), request.GET, _serialize_event)
    except ValueError:
        return JsonResponse({"error": "Invalid pagination."}, status=400)
    return JsonResponse(data)


@csrf_exempt
@never_cache
@require_PUT
@require_role(User.ROLE_ADMIN)
def moderate_event(request, event_id):
    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    try:
        data = _read_json(request)
        if set(data) != {"moderation_blocked"} or type(data["moderation_blocked"]) is not bool:
            raise ValueError("Invalid moderation flag.")
    except ValueError:
        return JsonResponse({"error": "Provide moderation_blocked as a boolean."}, status=400)
    Event.objects(id=event.id).update_one(set__moderation_blocked=data["moderation_blocked"])
    return JsonResponse({"id": str(event.id), "moderation_blocked": data["moderation_blocked"]})
