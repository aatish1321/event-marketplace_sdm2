# Event marketplace frontend

React, React Router, Vite, and Tailwind CSS.

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

These destinations currently contain minimal landing views for future features.
`ProtectedRoute` sends anonymous users to `/login`; `allowedRoles` restricts a
route to the specified roles and sends other authenticated users to their own
home. It supports both nested routes through `Outlet` and wrapped children.

JWT decoding and route guards control the browser UI only. The backend must
verify token signatures and enforce authorization for every protected API.

## Checks

```sh
npm test
npm run lint
npm run build
```

The Vitest suite uses React Testing Library with jsdom and mocked HTTP responses
to exercise login, session handling, and role routing without a running backend.
