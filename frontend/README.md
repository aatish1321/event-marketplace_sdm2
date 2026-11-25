# Event marketplace frontend

React, React Router, Vite, and Tailwind CSS.

Ticket receipts display admission QR codes locally using pinned
`qrcode-generator@2.0.4`, with the signed text code retained as a fallback.
There are no QR service requests or camera scanning permissions. When updating
an existing Docker development image, rebuild the frontend after this dependency
change so the image includes the new package.

## Development

```sh
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8000` when running locally and to
`http://backend:8000` inside Docker. Set `API_PROXY_TARGET` to override the target.

### Docker development

Compose mounts source files and frontend configuration for live editing. Both
services keep their dependencies inside their images; `node_modules` and `.venv`
are not mounted or retained in separate volumes. Each build context excludes
host dependencies and environment files.

After changing `package.json`, `package-lock.json`, `pyproject.toml`, or `uv.lock`,
rebuild the affected service from the project root:

```sh
docker compose up -d --build --no-deps frontend
# For backend dependency changes:
docker compose up -d --build --no-deps backend
```

New images supply their own dependencies, so old dependency volumes cannot hide
updated packages. Source edits still reload without rebuilding. Changes to other
image files, such as Dockerfiles or backend project metadata, require a rebuild.

## Authentication and routing

`/register` creates an account; `/login` sends `{ email, password }` to
`POST /api/auth/login/`. The returned `token` is passed to `AuthContext`, which
persists it under `access_token` and clears the session when it expires.

After login, users go to their role's home:

| Role | Route |
| --- | --- |
| Attendee | `/discover` |
| Organizer | `/dashboard` |
| Admin | `/admin-logs` |

The organizer dashboard lists the signed-in organizer's events and provides a
Create New Event modal and sales analytics. Attendees use the discovery catalog
and My tickets receipts; admins can review the system log table.
`ProtectedRoute` sends anonymous users to `/login`; `allowedRoles` restricts a
route to the specified roles and sends other authenticated users to their own
home. It supports both nested routes through `Outlet` and wrapped children.

JWT decoding and route guards control the browser UI only. The backend must
verify token signatures and enforce authorization for every protected API.

## Organizer events

At `/dashboard`, organizers can review their events and create physical or online
events. The form accepts a title, optional description, and start/end date and
time. Physical events require a venue name and address; online events require an
HTTP(S) event URL. Changing event type sends only the active location fields.

Date inputs use the browser's local time zone and are sent as UTC ISO timestamps.
The list displays dates in the viewer's local time. End time must follow start
time. A successful create adds the saved event to the list without a page reload.

Requests use the AuthContext token as `Authorization: Bearer <token>` with
`GET /api/events/?mine=1` and `POST /api/events/`. Ownership is assigned and checked
by the backend; the client does not choose an organizer ID. Public event discovery
continues to use `GET /api/events/` without `mine`.

Creation uses the existing event schema: `venue_name` and `address` for physical
events, or `stream_url` for online events. Older events without scheduled dates
remain visible with a date-unavailable label.

## Tickets, analytics, and admin logs

- Attendees can open `/my-tickets` from their navigation or checkout confirmation.
  Receipt cards show saved event details, ticket quantity, purchase ID, booking
  date, unit price, and total. Older receipts show "Amount not recorded".
- The organizer dashboard includes `AnalyticsWidget`: order and ticket counts,
  events with sales, and booked revenue grouped by currency. Legacy purchases
  without amounts are identified separately. Refresh reloads the totals.
- `/admin-logs` displays the admin-only error table with timestamp, severity,
  request details, and expandable diagnostics. Pagination keeps long histories
  manageable.

The create-event form accepts ticket price, currency (EUR/USD/HUF), and available
tickets. Prices are converted to integer minor units without floating-point
rounding. Checkout displays the unit price and order total, submits the expected
price, and asks the attendee to review the updated price if it changed. The
recorded total is an order value; the app does not collect payments.

All three views support loading, empty, retry, and expired-session states. Reads
are cancelled on navigation or account changes so private data cannot remain
visible under a different session.

## Verification

```sh
npm test
npm run lint
npm run build
```

The Vitest suite uses React Testing Library with jsdom and mocked HTTP responses
to exercise login, session handling, and role routing without a running backend.
