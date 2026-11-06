# EVENT MARKETPLACE

A modern, role-based event management platform designed to streamline event planning, user registration, and scheduling. The application provides tailored workflows and permission levels for **Admins**, **Speakers**, and **Attendees**.

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
