"""Admin-only review of persisted crash logs."""

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .decorators import require_role
from .event_views import _iso_date
from .models import SystemLog


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
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
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
