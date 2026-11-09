# Backend authentication API

Both endpoints accept JSON and allow POST only (other methods return 405).
They do not create sessions or set authentication cookies.

## Register: `/api/auth/register/`

```json
{
  "email": "organizer@example.com",
  "password": "your-password",
  "full_name": "Example Organizer",
  "role": "organizer",
  "organizer_profile": {
    "name": "Example Events",
    "contact_email": "contact@example.com",
    "organization_id": "org-123"
  }
}
```

`email`, `password`, `full_name`, and `role` are required non-empty strings.
Public registration accepts `attendee` or `organizer`. Administrators must be
provisioned separately. Organizers must supply all three profile fields shown
above; attendees can omit `organizer_profile`. Emails are validated by the
existing MongoEngine schema. Email lookup and uniqueness retain the model's
case-sensitive behavior; surrounding whitespace in email is removed.

Returns 201 with `user_id`, `email`, `full_name`, and `role`; never returns the
password or hash. Invalid input returns 400 and duplicate email returns 409.
Passwords are stored through `User.set_password()` using Django's hashers.

## Login: `/api/auth/login/`

```json
{"email": "organizer@example.com", "password": "your-password"}
```

Returns 200 with `token`, `token_type` (`Bearer`), and `expires_in` (3600 seconds).
The JWT is signed with HS256 using the configured Django `SECRET_KEY` (loaded
from `DJANGO_SECRET_KEY`), and contains `user_id`, the stored `role`, `iat`, and
`exp`. Existing users of all model roles can log in. Consumers must verify the
signature with the same key, explicitly allow only HS256, and validate expiry.
Token refresh is outside these endpoints.

Invalid credentials return the same generic 401 error for an unknown email or
wrong password. Missing/invalid fields, malformed JSON, non-object JSON, and
invalid UTF-8 return 400 on both endpoints. Password whitespace is preserved.

## Protected views and error tracking

Use the role guard on function views:

```python
from config.decorators import require_role

@require_role(["organizer", "admin"])
def protected_view(request):
    user_id = request.jwt_payload["user_id"]
    # Return the view's response here.
```

Send `Authorization: Bearer <token>` using a token from login. The guard verifies
HS256 signatures, required claims, and token lifetime. Missing, malformed,
expired, or disallowed credentials return JSON `{"error": "Forbidden."}` with
status 403. A single role string is also accepted; an empty role list denies all.
Verified claims are available as `request.jwt_payload`. Authorization is
stateless: role changes or account deletion do not invalidate already issued
tokens before expiry. Registration and login remain public.

`MongoExceptionLoggingMiddleware` records unhandled view exceptions in
`SystemLog`, including the traceback, path (without query parameters), method,
message, and status 500. Django retains its normal error response behavior.
If saving to MongoDB fails, the middleware reports the logging failure through
Python logging and preserves the original exception. As with Django's
`process_exception` hook, errors outside view execution are not captured.

## Events API

`GET /api/events/` returns a JSON array; `GET /api/events/<event_id>/` returns
one event. Both reads are public. Events contain `id`, `event_type`, and their
model fields. `event_type` is `event`, `physical`, or `online`.

All writes require `Authorization: Bearer <token>` with the `organizer` role.
Administrators and attendees cannot write events.

- `POST /api/events/` returns 201 with the created event. Supply a nonblank
  `title`; optionally supply `status`, `continent`, `country`, and
  `available_tickets` (an integer from 0 to 9223372036854775807, default 0).
  `event_type` defaults
  to `event`. Physical events require `venue_name` and `address`; online events
  require a valid `stream_url`.
- `PUT /api/events/<event_id>/` returns 200 with the updated event. Supplied
  fields replace their current values; omitted fields retain their values.
  Event type cannot be changed.
- `DELETE /api/events/<event_id>/` returns 204 with no body.

Creation sets `organizer_id` from the verified JWT. Client-supplied
`organizer_id` is ignored on creation and update. Only the exact matching
JWT user ID can update or delete an event; other organizers receive 403.
Unknown fields, invalid JSON, and invalid field values return 400. Invalid or
missing event IDs return 404; unsupported methods return 405. Unexpected
database errors use the existing exception logging middleware.

## Geographic discovery (Task 2.3)

`GET /api/events/nearby/?latitude=47.4979&longitude=19.0402&radius_km=10`
is public and returns a JSON array of physical events, nearest first. Each
result includes the usual event fields, `location`, and `distance_km` (a
numeric distance in kilometres). No matches returns `[]` with status 200.

| Parameter | Required | Accepted values |
| --- | --- | --- |
| `latitude` | Yes | Finite number from -90 to 90 |
| `longitude` | Yes | Finite number from -180 to 180 |
| `radius_km` | Yes | Finite number greater than 0 and at most 1000 |
| `limit` | No | Integer from 1 to 100; default 20 |
| `country` | No | Nonblank exact, case-sensitive match; surrounding whitespace trimmed |
| `continent` | No | Nonblank exact, case-sensitive match; surrounding whitespace trimmed |

Missing, invalid, unknown, or repeated query parameters return status 400 with
an `error` message. Unsupported HTTP methods return 405. Equal-distance result
order is unspecified. The response is a limited nearest-results list, without
pagination or a total count. Event status and ticket availability are not
implicitly filtered, matching the existing public event reads.

Organizers can provide coordinates through the existing create/update routes:

```json
{
  "event_type": "physical",
  "title": "Budapest Meetup",
  "venue_name": "Conference Hall",
  "address": "Budapest, Hungary",
  "continent": "Europe",
  "country": "Hungary",
  "location": {"type": "Point", "coordinates": [19.0402, 47.4979]}
}
```

GeoJSON uses **longitude first, latitude second**. Coordinates must be two
finite JSON numbers within the ranges above; booleans and numeric strings are
rejected. `location` is optional and only accepted for physical events. An
update omitting it preserves the existing point; `"location": null` clears it.
Existing events without coordinates remain valid but are excluded from nearby
searches, as are online and base events. Addresses are not automatically geocoded.
The existing organizer ownership rules apply to location changes.

MongoEngine creates a `2dsphere` index for the new optional field. No SQL
migration or dependency change is required. On deployment, you can explicitly
prepare the index in the backend environment:

```sh
uv run python manage.py shell -c "from config.models import PhysicalEvent; PhysicalEvent.ensure_indexes()"
```

Discovery uses MongoDB's `$geoNear` aggregation with a bounded radius and result
limit. See the [MongoDB reference](https://www.mongodb.com/docs/manual/reference/operator/aggregation/geonear/).

## Verification

From `backend/`, with the project's environment configured:

```sh
uv sync --group dev
uv run manage.py test
uv run manage.py check
```

The default tests use `mongomock` and do not write to the configured MongoDB
database. Because mongomock does not implement `$geoNear`, discovery unit tests
mock only the aggregation boundary. The opt-in integration suite verifies real
MongoDB distances, radius filtering, ordering, and geospatial indexes.

To run the real MongoDB suite, start a disposable MongoDB instance and set
`GEODISCOVERY_TEST_MONGO_URI` to its connection URI. For example, in PowerShell
from the backend directory, with the normal Django environment configured:

```powershell
docker run --detach --rm --name marketplace-geo-tests --publish 127.0.0.1:27028:27017 mongo:7.0.14
$env:GEODISCOVERY_TEST_MONGO_URI = "mongodb://127.0.0.1:27028"
uv run manage.py test config.test_discovery config.test_discovery_mongo
docker stop marketplace-geo-tests
Remove-Item Env:GEODISCOVERY_TEST_MONGO_URI
```

The real MongoDB tests create and remove their own randomly named test database.
Without the opt-in variable, those tests are skipped.
The backend CI job supplies a MongoDB service and enables these integration tests.
