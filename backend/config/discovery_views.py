"""Public discovery of physical events using MongoDB's spherical geo index."""

import math

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .event_views import _serialize_event
from .models import PhysicalEvent


def _search_parameters(query):
    allowed = {"latitude", "longitude", "radius_km", "limit", "country", "continent"}
    if set(query) - allowed or any(len(query.getlist(key)) != 1 for key in query):
        raise ValueError("Unknown or repeated search parameters.")
    values = {}
    for name, low, high in (("latitude", -90, 90), ("longitude", -180, 180), ("radius_km", 0, 1000)):
        try:
            value = float(query[name])
        except (KeyError, ValueError, OverflowError) as exc:
            raise ValueError(f"{name} must be a finite number.") from exc
        if not math.isfinite(value) or not low <= value <= high or (name == "radius_km" and value == 0):
            raise ValueError(f"{name} is outside its allowed range.")
        values[name] = value
    raw_limit = query.get("limit", "20")
    if not raw_limit.isascii() or not raw_limit.isdecimal() or not 1 <= int(raw_limit) <= 100:
        raise ValueError("limit must be an integer from 1 to 100.")
    values["limit"] = int(raw_limit)
    filters = {"_cls": PhysicalEvent._class_name}
    for name in ("country", "continent"):
        if name in query:
            value = query[name].strip()
            if not value:
                raise ValueError(f"{name} must not be blank.")
            filters[name] = value
    return values, filters


@csrf_exempt
@require_GET
def nearby_events(request):
    try:
        values, filters = _search_parameters(request.GET)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    # Use the collection directly: QuerySet.aggregate may prepend inheritance
    # filters, whereas MongoDB requires $geoNear to be the first stage.
    pipeline = [
        {"$geoNear": {
            "near": {"type": "Point", "coordinates": [values["longitude"], values["latitude"]]},
            "key": "location",
            "distanceField": "distance_m",
            "maxDistance": values["radius_km"] * 1000,
            "spherical": True,
            "query": filters,
        }},
        {"$limit": values["limit"]},
    ]
    results = []
    for document in PhysicalEvent._get_collection().aggregate(pipeline):
        distance_km = document.pop("distance_m") / 1000
        event = PhysicalEvent._from_son(document)
        results.append({**_serialize_event(event), "distance_km": distance_km})
    return JsonResponse(results, safe=False)
