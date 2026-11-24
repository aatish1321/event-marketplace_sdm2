"""Private purchase receipts and organizer revenue summaries."""

from datetime import timezone

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .decorators import require_role
from .models import Event, Ticket, User


def _private_json(data, status=200):
    response = JsonResponse(data, status=status)
    response["Cache-Control"] = "private, no-store"
    return response


def _pagination(query):
    if set(query) - {"limit", "offset"} or any(len(query.getlist(key)) != 1 for key in query):
        raise ValueError("Only one limit and offset parameter are supported.")
    values = []
    for name, default, low, high in (("limit", "20", 1, 100), ("offset", "0", 0, 100000)):
        raw = query.get(name, default)
        if not raw.isascii() or not raw.isdecimal() or not low <= int(raw) <= high:
            raise ValueError(f"{name} must be an integer from {low} to {high}.")
        values.append(int(raw))
    return values


def _serialize_ticket(ticket):
    created_at = ticket.created_at
    if created_at.tzinfo is None:
        # PyMongo returns naive UTC datetimes unless tz_aware is enabled.
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "id": str(ticket.id),
        "event_id": str(ticket.event_id),
        "event_title": ticket.event_title,
        "quantity": ticket.quantity,
        "total_paid": format(ticket.total_paid, "f"),
        "currency": ticket.currency,
        "status": ticket.status,
        "created_at": created_at.astimezone(timezone.utc).isoformat(),
    }


@csrf_exempt
@require_GET
@require_role(User.ROLE_CHOICES)
def user_tickets(request):
    try:
        limit, offset = _pagination(request.GET)
    except ValueError:
        return _private_json({"error": "Invalid request parameters."}, status=400)
    tickets = list(
        Ticket.objects(user_id=request.jwt_payload["user_id"])
        .order_by("-created_at", "-id").skip(offset).limit(limit + 1)
    )
    return _private_json({
        "tickets": [_serialize_ticket(ticket) for ticket in tickets[:limit]],
        "limit": limit,
        "offset": offset,
        "has_more": len(tickets) > limit,
    })


@csrf_exempt
@require_GET
@require_role(User.ROLE_ORGANIZER)
def organizer_analytics(request):
    if request.GET:
        return _private_json({"error": "This endpoint does not accept query parameters."}, status=400)
    # Start from ownership to avoid accepting client-supplied organizer/event IDs.
    # A join against extant events also excludes deleted events and orphan receipts.
    pipeline = [
        {"$match": {"organizer_id": request.jwt_payload["user_id"]}},
        {"$lookup": {
            "from": Ticket._get_collection_name(),
            "localField": "_id",
            "foreignField": "event_id",
            "as": "receipts",
        }},
        {"$unwind": "$receipts"},
        {"$match": {"receipts.status": Ticket.STATUS_PAID}},
        {"$group": {
            "_id": "$receipts.currency",
            "total_revenue": {"$sum": "$receipts.total_paid"},
            "tickets_sold": {"$sum": "$receipts.quantity"},
            "receipt_count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    # Ensure receipt indexes exist even when analytics is the first access.
    Ticket._get_collection()
    revenue = [
        {
            "currency": group["_id"],
            "total_revenue": format(group["total_revenue"].to_decimal(), "f"),
            "tickets_sold": group["tickets_sold"],
            "receipt_count": group["receipt_count"],
        }
        for group in Event._get_collection().aggregate(pipeline)
    ]
    return _private_json({"revenue": revenue})
