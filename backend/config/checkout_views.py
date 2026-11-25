"""Attendee checkout with an atomic inventory reservation."""

from django.core import signing
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from mongoengine.errors import ValidationError

from .auth_views import _read_json, _required_string
from .decorators import require_role
from .event_views import EVENT_TYPES, _bookable, _find_event, _iso_date
from .models import CURRENCIES, MAX_SAFE_AMOUNT, BuyerSnapshot, Event, EventSnapshot, TicketPurchase, User


def _price_changed():
    return JsonResponse({
        "error": "Ticket price changed. Please review the current price.",
        "code": "price_changed",
    }, status=409)


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
        required = {"event_id", "quantity"}
        expected = {"expected_unit_price_minor", "expected_currency"}
        if set(data) not in (required, required | expected):
            raise ValueError("Provide event_id and quantity, optionally with the expected price pair.")
        if expected.issubset(data):
            price, currency = data["expected_unit_price_minor"], data["expected_currency"]
            if (price is None) != (currency is None):
                raise ValueError("Expected price and currency must be supplied together.")
            if price is not None and (type(price) is not int or not 0 <= price <= MAX_SAFE_AMOUNT):
                raise ValueError("Invalid expected price.")
            if currency is not None and (not isinstance(currency, str) or currency not in CURRENCIES):
                raise ValueError("Invalid expected currency.")
        event_id = _required_string(data, "event_id")
        qty = data["quantity"]
        if type(qty) is not int or not 1 <= qty <= 2**63 - 1:
            raise ValueError("quantity must be a positive BSON integer.")
        safe_qty = int(qty)
    except ValueError:
        return JsonResponse({"error": "Invalid request payload."}, status=400)

    event = _find_event(event_id)
    if event is None:
        return JsonResponse({"error": "Event not found."}, status=404)
    if not _bookable(event):
        return JsonResponse({"error": "This event is no longer available for booking.", "code": "event_unavailable"}, status=409)
    if "expected_unit_price_minor" in data and (
        data["expected_unit_price_minor"] != event.ticket_price_minor
        or data["expected_currency"] != event.currency
    ):
        return _price_changed()
    total = None if event.ticket_price_minor is None else event.ticket_price_minor * safe_qty
    if total is not None and total > MAX_SAFE_AMOUNT:
        return JsonResponse({"error": "Purchase amount exceeds the supported limit."}, status=400)
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
        quantity=safe_qty,
        unit_price_minor=event.ticket_price_minor,
        total_amount_minor=total,
        currency=event.currency,
    )
    purchase.validate()
    # Legacy documents can omit status even though MongoEngine loads the published default.
    if not Event.objects(
        id=event.id, available_tickets__gte=safe_qty,
        ticket_price_minor=event.ticket_price_minor, currency=event.currency,
        status__in=[None, "", "published"], moderation_blocked__ne=True, end_at=event.end_at,
    ).update_one(dec__available_tickets=safe_qty):
        current = _find_event(event_id)
        if current is None:
            return JsonResponse({"error": "Event not found."}, status=404)
        if not _bookable(current):
            return JsonResponse({"error": "This event is no longer available for booking.", "code": "event_unavailable"}, status=409)
        if current.ticket_price_minor != event.ticket_price_minor or current.currency != event.currency:
            return _price_changed()
        if current.available_tickets < safe_qty:
            return JsonResponse({"error": "Not enough tickets available.", "code": "insufficient_stock"}, status=409)
        return JsonResponse({"error": "Event details changed. Review the event and try again.", "code": "event_changed"}, status=409)
    # shortcut: failed saves or crashes can strand stock; add transactions or reconciliation for recovery.
    # A failed acknowledgement may follow a successful insert, so refunding here could oversell.
    purchase.save()

    return JsonResponse(serialize_purchase(purchase), status=201)


def serialize_purchase(purchase, event_status=None):
    """Serialize immutable receipt snapshots for checkout and ticket history."""
    return {
        "id": str(purchase.id),
        "quantity": purchase.quantity,
        "checked_in": purchase.checked_in,
        "admission_code": signing.Signer(salt="event-admission").sign(str(purchase.id)),
        "event_status": event_status,
        "booking_mode": "simulation",
        "created_at": _iso_date(purchase.created_at),
        "unit_price_minor": purchase.unit_price_minor,
        "total_amount_minor": purchase.total_amount_minor,
        "currency": purchase.currency,
        "buyer_snapshot": {field: getattr(purchase.buyer_snapshot, field) for field in (
            "user_id", "email", "full_name",
        )},
        "event_snapshot": {
            **{field: getattr(purchase.event_snapshot, field) for field in (
                "event_id", "title", "organizer_id", "event_type", "venue_name", "address", "stream_url",
            )},
            **{field: _iso_date(getattr(purchase.event_snapshot, field)) for field in ("start_at", "end_at")},
        },
    }
