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

## Verification

From `backend/`, with the project's environment configured:

```sh
uv sync --group dev
uv run manage.py test config.test_auth config.tests config.test_security
uv run manage.py check
```

The tests use `mongomock` and do not write to the configured MongoDB database.
