# Original User Request

## 2026-09-26T13:39:24Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Small focused team

This is a single self-contained feature; keep it small and focused. Create the core database schemas in `backend/config/models.py` for a Django project using MongoDB via `mongoengine`. Includes defining `OrganizerProfile`, `User`, and `SystemLog` models with password hashing methods.

Working directory: ~/teamwork_projects/django_mongo_models
Integrity mode: development

## Requirements

### R1. Define OrganizerProfile
Create an `OrganizerProfile` EmbeddedDocument with fields for `name`, `contact_email`, and `organization_id`.

### R2. Define User Document
Create a `User` Document with fields: `email` (unique), `password_hash`, `full_name`, `role` (choices: attendee, organizer, admin), and `organizer_profile` (embedding `OrganizerProfile`). Add `set_password` and `check_password` methods that utilize Django's default password hashers.

### R3. Define SystemLog Document
Create a `SystemLog` Document with fields: `level`, `endpoint`, `method`, `status_code`, `message`, `traceback`, and `timestamp`.

## Acceptance Criteria

### Verification (Programmatic)
- [ ] Agent-written unit tests for `OrganizerProfile` run and pass.
- [ ] Agent-written unit tests for `User` model run and pass, explicitly verifying that `set_password` hashes the input and `check_password` correctly validates it.
- [ ] Agent-written unit tests verify the `email` unique constraint on the `User` document.
- [ ] Agent-written unit tests for `SystemLog` run and pass.
- [ ] `backend/config/models.py` successfully imports without syntax or dependency errors.
