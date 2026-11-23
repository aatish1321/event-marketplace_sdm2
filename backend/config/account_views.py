"""Role-scoped receipt history and organizer purchase totals."""

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .admin_views import _bounded_int
from .checkout_views import serialize_purchase
from .decorators import require_role
from .models import TicketPurchase, User


@never_cache
@require_GET
@require_role(User.ROLE_ATTENDEE)
def my_tickets(request):
    try:
        limit = _bounded_int(request.GET, "limit", "20", 1, 100)
        offset = _bounded_int(request.GET, "offset", "0", 0, 2**31 - 1)
    except ValueError:
        return JsonResponse({"error": "Invalid request parameters."}, status=400)
    purchases = TicketPurchase.objects(
        buyer_snapshot__user_id=request.jwt_payload["user_id"],
    ).order_by("-created_at", "-id")
    return JsonResponse({
        "count": purchases.count(),
        "limit": limit,
        "offset": offset,
        "results": [serialize_purchase(purchase) for purchase in purchases.skip(offset).limit(limit)],
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
