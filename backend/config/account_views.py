"""Role-scoped receipt history and organizer purchase totals."""

from uuid import UUID

from bson import ObjectId
from django.core import signing
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from mongoengine.errors import ValidationError

from .admin_views import _bounded_int
from .checkout_views import serialize_purchase
from .auth_views import _read_json, _required_string
from .decorators import require_role
from .event_views import _bookable, _find_event
from .models import AccountAccess, Event, TicketPurchase, User
from mongoengine.queryset.visitor import Q


@never_cache
@require_GET
@require_role(User.ROLE_ATTENDEE)
def my_tickets(request):
    try:
        limit = _bounded_int(request.GET, "limit", "20", 1, 100)
        offset = _bounded_int(request.GET, "offset", "0", 0, 2**31 - 1)
        event_id = request.GET.get("event_id")
        if event_id is not None:
            if len(request.GET.getlist("event_id")) != 1 or not ObjectId.is_valid(event_id):
                raise ValueError("Invalid event ID.")
            event_id = str(ObjectId(event_id))
    except ValueError:
        return JsonResponse({"error": "Invalid request parameters."}, status=400)
    purchases = TicketPurchase.objects(
        buyer_snapshot__user_id=request.jwt_payload["user_id"],
    ).order_by("-created_at", "-id")
    if event_id is not None:
        purchases = purchases.filter(event_snapshot__event_id=event_id)
    page = list(purchases.skip(offset).limit(limit))
    event_ids = [ObjectId(p.event_snapshot.event_id) for p in page if ObjectId.is_valid(p.event_snapshot.event_id)]
    suspended = set(AccountAccess.objects(active=False).scalar("user_id"))
    statuses = {
        str(event.id): "unavailable" if event.moderation_blocked or event.organizer_id in suspended or event.status == "draft" else event.status
        for event in Event.objects(id__in=event_ids).only("status", "moderation_blocked", "organizer_id")
    }
    return JsonResponse({
        "count": purchases.count(),
        "limit": limit,
        "offset": offset,
        "results": [serialize_purchase(purchase, statuses.get(purchase.event_snapshot.event_id, "unavailable")) for purchase in page],
    })


@never_cache
@require_GET
@require_role(User.ROLE_ORGANIZER)
def organizer_analytics(request):
    # Stream only the owner's purchase facts, without loading buyer information.
    # Python integers keep sums exact beyond BSON/JavaScript integer limits.
    purchases = TicketPurchase._get_collection().find(
        {"event_snapshot.organizer_id": request.jwt_payload["user_id"]},
        {"quantity": 1, "event_snapshot.event_id": 1, "total_amount_minor": 1, "currency": 1},
    )
    purchase_count = tickets_sold = unpriced = 0
    event_ids = set()
    revenue = {}
    for purchase in purchases:
        purchase_count += 1
        tickets_sold += purchase["quantity"]
        event_ids.add(purchase["event_snapshot"]["event_id"])
        amount, currency = purchase.get("total_amount_minor"), purchase.get("currency")
        if amount is None or currency is None:
            unpriced += 1
        else:
            revenue[currency] = revenue.get(currency, 0) + amount
    return JsonResponse({
        "purchase_count": purchase_count,
        "tickets_sold": tickets_sold,
        "events_with_sales": len(event_ids),
        "unpriced_purchase_count": unpriced,
        "revenue_by_currency": [
            {"currency": currency, "total_amount_minor": str(revenue[currency])}
            for currency in sorted(revenue)
        ],
    })


def _account_user(user_id):
    if not ObjectId.is_valid(user_id):
        return None
    return User.objects(id=ObjectId(user_id)).first()


@csrf_exempt
@never_cache
@require_http_methods(["GET", "PUT"])
@require_role(User.ROLE_CHOICES)
def account(request):
    user = _account_user(request.jwt_payload["user_id"])
    if user is None:
        return JsonResponse({"error": "Account not found."}, status=404)
    if request.method == "PUT":
        try:
            data = _read_json(request)
            allowed = {"full_name", "organizer_profile"} if user.role == User.ROLE_ORGANIZER else {"full_name"}
            if set(data) - allowed:
                raise ValueError("Only profile fields can be changed here.")
            if "full_name" in data:
                user.full_name = _required_string(data, "full_name").strip()
                if len(user.full_name) > 200:
                    raise ValueError("Name is too long.")
            if "organizer_profile" in data:
                from .models import OrganizerProfile
                profile = data["organizer_profile"]
                if not isinstance(profile, dict) or set(profile) != {"name", "contact_email", "organization_id"}:
                    raise ValueError("Invalid organizer profile.")
                user.organizer_profile = OrganizerProfile(**{key: _required_string(profile, key).strip() for key in profile})
            user.save()
        except (ValueError, ValidationError):
            return JsonResponse({"error": "Invalid profile details."}, status=400)
    return JsonResponse({
        "full_name": user.full_name, "email": user.email, "role": user.role,
        "organizer_profile": dict(user.organizer_profile.to_mongo()) if user.organizer_profile else None,
    })


@csrf_exempt
@never_cache
@require_POST
@require_role(User.ROLE_CHOICES)
def change_password(request):
    user = _account_user(request.jwt_payload["user_id"])
    if user is None:
        return JsonResponse({"error": "Account not found."}, status=404)
    try:
        data = _read_json(request)
        if set(data) != {"current_password", "new_password"}:
            raise ValueError("Invalid password fields.")
        current = _required_string(data, "current_password")
        password = _required_string(data, "new_password")
        if not 8 <= len(password) <= 128:
            raise ValueError("Use between 8 and 128 characters.")
        if not user.check_password(current):
            return JsonResponse({"error": "Current password is incorrect."}, status=400)
    except ValueError:
        return JsonResponse({"error": "Provide the current password and a new password of 8–128 characters."}, status=400)
    previous_hash = user.password_hash
    user.set_password(password)
    if not User.objects(id=user.id, password_hash=previous_hash).update_one(set__password_hash=user.password_hash):
        return JsonResponse({"error": "Password changed in another session. Log in again."}, status=409)
    AccountAccess.objects(user_id=str(user.id)).update_one(inc__version=1, upsert=True)
    return JsonResponse({"message": "Password changed. Log in again on each device."})


@csrf_exempt
@never_cache
@require_POST
@require_role(User.ROLE_ORGANIZER)
def check_in(request):
    try:
        data = _read_json(request)
        if set(data) != {"admission_code", "quantity", "request_id"}:
            raise ValueError("Invalid check-in fields.")
        code = _required_string(data, "admission_code").strip()
        if len(code) > 200:
            raise ValueError("Invalid admission code.")
        purchase_id = signing.Signer(salt="event-admission").unsign(code)
        count = data["quantity"]
        request_id = _required_string(data, "request_id")
        if str(UUID(request_id)) != request_id:
            raise ValueError("Invalid request ID.")
        if not ObjectId.is_valid(purchase_id) or type(count) is not int or count < 1:
            raise ValueError("Invalid check-in.")
    except (ValueError, signing.BadSignature):
        return JsonResponse({"error": "Invalid admission code or quantity."}, status=400)
    purchase = TicketPurchase.objects(id=ObjectId(purchase_id), event_snapshot__organizer_id=request.jwt_payload["user_id"]).first()
    if purchase is None:
        return JsonResponse({"error": "Booking not found for your events."}, status=404)
    event = _find_event(purchase.event_snapshot.event_id)
    if event is None or not _bookable(event) or event.organizer_id != request.jwt_payload["user_id"]:
        return JsonResponse({"error": "This event is unavailable."}, status=409)
    if count > purchase.quantity:
        return JsonResponse({"error": "Not enough unused admissions remain."}, status=409)
    receipt = f"{request_id}:{count}"
    if any(item.startswith(f"{request_id}:") and item != receipt for item in purchase.check_in_requests):
        return JsonResponse({"error": "This request ID was already used for another quantity."}, status=409)
    if receipt in purchase.check_in_requests:
        return JsonResponse({"event_title": event.title, "checked_in": purchase.checked_in, "quantity": purchase.quantity})
    updated = TicketPurchase.objects(
        Q(checked_in__lte=purchase.quantity - count) | Q(checked_in__exists=False), id=purchase.id,
        check_in_requests__not__startswith=f"{request_id}:",
    ).modify(new=True, inc__checked_in=count, push__check_in_requests=receipt)
    if updated is None:
        purchase.reload()
        if receipt in purchase.check_in_requests:
            return JsonResponse({"event_title": event.title, "checked_in": purchase.checked_in, "quantity": purchase.quantity})
        return JsonResponse({"error": "Not enough unused admissions remain."}, status=409)
    return JsonResponse({"event_title": event.title, "checked_in": updated.checked_in, "quantity": updated.quantity})
