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
Protected-resource middleware and token refresh are outside these endpoints.

Invalid credentials return the same generic 401 error for an unknown email or
wrong password. Missing/invalid fields, malformed JSON, non-object JSON, and
invalid UTF-8 return 400 on both endpoints. Password whitespace is preserved.

## Verification

From `backend/`, with the project's environment configured:

```sh
uv sync --group dev
uv run manage.py test config.test_auth config.tests
uv run manage.py check
```

The tests use `mongomock` and do not write to the configured MongoDB database.
