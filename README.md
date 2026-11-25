# EVENT MARKETPLACE

A role-based event booking demo for **Admins**, **Organizers**, and **Attendees**. Bookings reserve inventory and issue admission codes; no money is collected.

---

## 🚀 Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Python, Django, `django-cors-headers`, `django-environ`, `mongoengine` (managed with [`uv`](https://docs.astral.sh/uv/))
- **Database:** MongoDB
- **Containerization:** Docker & Docker Compose

---

## 📁 Project Structure

```text
event-marketplace_sdm2/
├── backend/               # Django backend & API
│   ├── config/            # Project settings & URL routing
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── models.py      # Database models
│   ├── manage.py
│   ├── pyproject.toml     # Backend dependencies managed by uv
│   └── Dockerfile         # Docker configuration for backend
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components (shadcn/ui)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile         # Docker configuration for frontend
├── docker-compose.yml     # Container orchestration
├── .env                   # Environment configuration
└── README.md
```

## 👥 Team Members

- **Aatish Ajay**
- **Hrishikesh Thorat**
- **Nouman Khan**
- **Hina**
- **Ajoy**

---

## Automated checks

GitHub Actions runs the `CI` workflow on every pull request and on pushes to
`main`. You can also run it manually from the Actions tab. New pushes to the
same PR cancel its older run.

- **Backend tests:** Python 3.14, dependencies from `backend/uv.lock`, and the
  Django test suite. Tests use `mongomock` with dummy settings; no MongoDB server
  or repository secrets are needed.
- **Frontend checks:** Node 26, dependencies from `frontend/package-lock.json`,
  ESLint, Vitest, and the production build.

Run the same checks locally with your development environment configured:

```sh
cd backend
uv sync --locked --group dev
uv run --no-sync python manage.py test
```

```sh
cd frontend
npm ci
npm run lint
npm test
npm run build
```

The workflow reports failures but does not configure branch protection or merge
PRs. To block failed PRs, make `Backend tests` and `Frontend checks` required
checks in the GitHub rules for `main` after the workflow's first run.

## Current workflows

- Attendees filter physical/online events by country and continent, search nearby
  physical events by coordinates, book tickets, and view receipts and admission codes.
- Organizers create drafts or published events, edit details and remaining stock,
  cancel events, see booking totals, and admit guests at `/check-in`.
- Only drafts without bookings can be deleted. Cancelled events cannot be reopened;
  receipts retain the original event details and show the current cancellation status.
- Admins review logs and use `/admin` to suspend/restore non-admin accounts and
  hide/restore events. Suspension invalidates existing sessions and hides the
  organizer's events. Restoring an account requires a fresh login.
- Every role can edit profile details and change their password at `/account`.
  Password changes invalidate all existing sessions. Email changes, verification,
  emailed password recovery, payments, and refunds are deferred.

Admission uses a signed code for each booking and an atomic used-admission count.
My tickets displays that code as a QR image generated locally in the browser, with
the original text available under “Show text code instead”. No admission data is
sent to a QR service. Group bookings can arrive in parts; the organizer chooses
how many guests to admit. Check-in still uses manual code entry; camera scanning
is not included.

The canonical reporting endpoint is `/api/organizer/analytics/`, backed by
`TicketPurchase`, the same records checkout writes. The older `Ticket` ledger is
retained at `/api/user/tickets/` and `/api/legacy/organizer/analytics/` for compatibility;
it does not represent bookings made through the demo checkout.

## Accessing administration

Open `/admin` on the **frontend**, normally `http://localhost:5173/admin`.
Logs are at `/admin-logs`; admin login currently lands on that page, where
“Manage users and events” links to administration. These routes require an
account whose stored role is `admin`. Public registration cannot create admins,
and Django's built-in admin is disabled for this MongoEngine application.

To provision your first admin, register a normal account you control, then use
a trusted backend shell. For local development:

```sh
cd backend
uv run --no-sync python manage.py shell
```

With the backend running in Compose, use this from the project root instead:

```sh
docker compose exec backend uv run --no-sync python manage.py shell
```

In that shell, replace the placeholder with your account's exact registered email:

```python
from config.models import AccountAccess, User
user = User.objects.get(email="your-email@example.com")
user.update(set__role=User.ROLE_ADMIN)
AccountAccess.objects(user_id=str(user.id)).update_one(inc__version=1, upsert=True)
```

Log out and log back in to get a token with the admin role, then open `/admin`.
No default admin credentials are shipped, and no account is promoted automatically.

## Deployment configuration

Compose remains a **local development** setup. Its published ports bind to loopback.
Do not expose the Django or Vite development servers to the Internet.

Production Django settings are in `config.production`. Supply
`DJANGO_SETTINGS_MODULE=config.production`, `DJANGO_ALLOWED_HOSTS=events.example.com`,
`DJANGO_SECRET_KEY`, and `MONGO_URI` through a separately controlled runtime.
The production settings reject missing/wildcard hosts, disable debug output, and
require HTTPS. Set `DJANGO_TRUST_PROXY=True` only behind a proxy that removes incoming
forwarded headers and supplies its own trusted values.

Build the frontend into `frontend/dist` in an isolated, reviewed build environment.
Serve that directory as static files, with `/api/` forwarded to the backend and
unknown frontend paths falling back to `index.html`. `deploy/nginx.conf` is a
loopback-only example behind a trusted local HTTPS terminator.

Run `config.wsgi:application` under your hosting platform's reviewed production WSGI
server, bound to loopback port 8000. No new server package has been installed here;
selecting and verifying that runtime is still required before deployment. The
development Dockerfiles are not production images.

Provision persistent MongoDB storage and backups before deployment. Existing local
MongoDB storage is unchanged: migrate it explicitly rather than replacing its mount
with a new empty volume. No database migration, deployment, or data deletion is run
by these source changes.
