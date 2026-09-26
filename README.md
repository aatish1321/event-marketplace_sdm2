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
