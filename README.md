# 🎟️ Event Marketplace (SDM2)

A modern, role-based event management platform designed to streamline event planning, user registration, and scheduling. The application provides tailored workflows and permission levels for **Admins**, **Speakers**, and **Attendees**.

---

## 🚀 Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
* **Backend:** Python, Django, `django-cors-headers`, `django-environ` (managed with [`uv`](https://docs.astral.sh/uv/))
* **Database:** PostgreSQL

---

## 📁 Project Structure

```text
event-marketplace_sdm2/
├── backend/               # Django backend & API
│   ├── core/              # Project settings & URL routing
│   ├── manage.py
│   ├── pyproject.toml     # Backend dependencies managed by uv
│   └── .env               # Environment configuration
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components (shadcn/ui)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites

* **Node.js** (v18+) & **npm**
* **Python** (3.12+) & [`uv`](https://docs.astral.sh/uv/)
* **PostgreSQL** installed and running locally

---

### 1. Database Setup

Ensure PostgreSQL is running and the database exists:

```bash
createdb event_marketplace
```

---

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Configure your environment variables in `.env`:

```env
SECRET_KEY='your-secret-key'
DB_NAME=event_marketplace
DB_USER=your_postgres_username
DB_PASSWORD=''
DB_HOST=127.0.0.1
DB_PORT=5432
```

Run database migrations and start the Django server:

```bash
# Apply database migrations
uv run python manage.py migrate

# Start Django server (runs on http://127.0.0.1:8000)
uv run python manage.py runserver
```

---

### 3. Frontend Setup

In a new terminal window, navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies and start the development server:

```bash
# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

---

## 👥 Team Members

* **Aatish Ajay**
* **Hrishikesh Thorat**
* **Nouman Khan**
* **Hina**

---

## 📜 License

This project is developed for academic / course purposes.
