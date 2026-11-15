"""Attendee checkout with an atomic inventory reservation."""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from mongoengine.errors import ValidationError

from .auth_views import _read_json, _required_string
from .decorators import require_role
from .event_views import EVENT_TYPES, _find_event, _iso_date
from .models import BuyerSnapshot, Event, EventSnapshot, TicketPurchase, User


@csrf_exempt
@require_POST
@require_role(User.ROLE_ATTENDEE)
def checkout(request):
    try:
        buyer = User.objects(id=request.jwt_payload["user_id"], role=User.ROLE_ATTENDEE).first()
    except ValidationError:
        buyer = None
    if buyer is None:
        return JsonResponse({"error": "Forbidden."}, status=403)
    try:
        data = _read_json(request)
        if set(data) != {"event_id", "quantity"}:
            raise ValueError("Provide event_id and quantity only.")
        event_id = _required_string(data, "event_id")
        qty = data["quantity"]
        if type(qty) is not int or not 1 <= qty <= 2**63 - 1:
            raise ValueError("quantity must be a positive BSON integer.")
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)

    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    purchase = TicketPurchase(
        buyer_snapshot=BuyerSnapshot(
            user_id=str(buyer.id), email=buyer.email, full_name=buyer.full_name,
        ),
        event_snapshot=EventSnapshot(
            event_id=str(event.id), title=event.title, organizer_id=event.organizer_id,
            event_type=next(name for name, model in EVENT_TYPES.items() if type(event) is model),
            **{field: getattr(event, field, None) for field in (
                "start_at", "end_at", "venue_name", "address", "stream_url",
            )},
        ),
        quantity=qty,
    )
    purchase.validate()
    if not Event.objects(id=event.id, available_tickets__gte=qty).update_one(dec__available_tickets=qty):
        return JsonResponse({"error": "Not enough tickets available."}, status=409)
    # shortcut: failed saves or crashes can strand stock; add transactions or reconciliation for recovery.
    # A failed acknowledgement may follow a successful insert, so refunding here could oversell.
    purchase.save()

    return JsonResponse({
        "id": str(purchase.id),
        "quantity": purchase.quantity,
        "created_at": _iso_date(purchase.created_at),
        "buyer_snapshot": {field: getattr(purchase.buyer_snapshot, field) for field in (
            "user_id", "email", "full_name",
        )},
        "event_snapshot": {
            **{field: getattr(purchase.event_snapshot, field) for field in (
                "event_id", "title", "organizer_id", "event_type", "venue_name", "address", "stream_url",
            )},
            **{field: _iso_date(getattr(purchase.event_snapshot, field)) for field in ("start_at", "end_at")},
        },
    }, status=201)
