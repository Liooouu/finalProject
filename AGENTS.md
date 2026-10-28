# TrackED - Agent Instructions

## Quick Start

```bash
# Terminal 1 - Backend (requires MongoDB running on 127.0.0.1:27017)
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Project Structure

- `backend/` - Express.js + Mongoose API (port 5000)
  - `server.js` - Entry point, connects DB then starts server
  - `routes/` - auth, admin, events, account, protected
  - `models/` - User schema (password hashed pre-save)
  - `middleware/` - authMiddleware.js (protect, authorize)
  - `config/db.js` - MongoDB connection
  - `seedAdmin.js` - Creates default admin account

- `frontend/` - React 19 + Vite + Tailwind CSS v4 (port 5173)
  - `src/App.jsx` - Route definitions
  - `src/api/axios.js` - API client (base: http://localhost:5000/api)
  - `src/utils/auth.js` - JWT decode, role check, logout
  - `src/components/ProtectedRoute.jsx` - Role-based route guards

## Commands

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | backend/ | Start server with nodemon |
| `npm run start` | backend/ | Start server without watch |
| `npm run dev` | frontend/ | Start Vite dev server |
| `npm run lint` | frontend/ | Run ESLint |
| `npm run build` | frontend/ | Production build |
| `npm run seed:admin` | backend/ | Create the first admin account |
| `npm run deploy [-- api\|web\|both]` | repo root | Deploy to Coolify and wait for the result |
| `docker compose up --build` | repo root | Local smoke test of both deployment images |

## Tailwind CSS

Uses Tailwind v4 with `@tailwindcss/vite` plugin. No `tailwind.config.js` - styles are in `src/index.css` with `@import "tailwindcss"`.

## Auth Flow

1. Login POST to `/api/auth/login` returns `{ token, role }`
2. Token stored in `localStorage.token`
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. ProtectedRoute checks JWT role before rendering
5. Student login/signup continues to attendance face enrollment when not enrolled. No security PIN or trusted-device challenge is used. Email verification and Forgot Password use one-time email codes.

## Role System

- **student** - Can register, view events, mark attendance
- **organizer** - Organizer portal access is granted by an admin to an existing student via Promote Student; the student retains both portals, face enrollment and records. Legacy organizer accounts still work.
- **admin** - Promotes students to organizers, removes organizer access, edits student academic details, manages accounts and event information, monitors attendance and reports; cannot open stations or record/change attendance statuses. Existing-record service-hour corrections and identity/absence reviews remain administrative interventions.

Registration is **student-only**. Admins grant organizer access through `POST /api/admin/users/:id/promote-organizer`; do not create duplicate organizer accounts. Promoted accounts keep `role: student` plus `organizerAccess: true`. `/api/auth/switch-role` mints an explicitly scoped token after checking current database access.

## API Endpoints

| Route | Auth | Roles |
|-------|------|-------|
| POST /api/auth/register | None | student only |
| POST /api/auth/login | None | all |
| POST /api/auth/forgot-password | None | all |
| POST /api/auth/forgot-password/verify | None | all |
| /api/admin/* | Bearer | admin (organizer also: student directory) |
| POST /api/auth/switch-role | Bearer | granted student/organizer portals only |
| /api/events/* | Bearer | varies |
| /api/account/* | Bearer | all |

## Setup Requirements

- MongoDB must be running at `127.0.0.1:27017`
- Backend `.env` contains `MONGO_URI`, `PORT=5000`, `JWT_SECRET`, `JWT_EXPIRES_IN`, plus `SMTP_*` (without them, email verification and "Forgot Password?" emails never leave the machine)
- Run `npm run seed:admin` once to create the first admin account

## Deployment

Deployed on Coolify as **two applications plus a MongoDB service in one
project**: `backend/` and `frontend/`, each built from its own Dockerfile.
There is also a **single-container deployment** (root `Dockerfile`) for
OpenShift or Vercel: it serves the SPA and API together on port `8080`
(OpenShift) or `PORT=80` (Vercel) - see `docs/DEPLOY_OPENSHIFT.md` and
`docs/DEPLOY_VERCEL.md`.

- The frontend container serves the SPA with nginx and proxies `/api` and
  `/uploads` to the API over the internal Docker network, so the SPA uses
  **relative URLs** - no `VITE_*` API URL, no CORS.
- The API runs on port 5000 as a non-root user. Uploads (profile pictures, face
  photos, excuse attachments) are stored in MongoDB **GridFS**, so the old
  `/app/uploads` volume is no longer required.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` create the first admin on boot, only when no
  admin exists.
- **Deploys are manual.** Redeploy the app whose directory changed — two
  equivalent paths, both driving the Coolify CLI (which reads its own stored
  context token, so no token lives in the repo):
  - `npm run deploy` (root `scripts/deploy.mjs`) — one command that triggers the
    build and waits: `npm run deploy [-- api|web|both] [--dry-run]` (default
    both, api first).
  - `coolify deploy uuid <app-uuid>`, then `coolify deploy get <deployment-uuid>`
    to watch. UUIDs: `tracked-web` = `wch2xf2obvaazogtim1advqu`,
    `tracked-api` = `eflvv8s2turwoceyhqwidt5z`.
- **Pushing to `main` deploys.** The two GitHub Actions workflows
  (`.github/workflows/deploy-*.yml`) call the Coolify deploy API for the app whose
  directory changed (`frontend/**` → `tracked-web`, `backend/**` → `tracked-api`)
  and wait for the deployment to finish, using the `COOLIFY_URL` +
  `COOLIFY_TOKEN` repository secrets. Verified 2026-10-26. The manual Git webhook
  is kept as a fallback, but Coolify **Auto deploy** is set to **Manual** so a
  push does not double-deploy. (The old failure was Cloudflare **Bot Fight Mode**
  challenging GitHub's datacenter runners, since turned off for the `vispo.me`
  zone.)
- **`docker compose up --build`** at the repo root runs the whole stack locally
  (web on :8080, api on :5000) for testing the real images.

Full instructions, environment variables and troubleshooting:
**`docs/DEPLOY.md`** (Coolify) and **`docs/DEPLOY_VERCEL.md`** (Vercel +
Atlas).

When changing anything that touches URLs or ports, verify it in the containers,
not just with `npm run dev` — that is exactly how the hardcoded
`http://localhost:5000` references in the frontend went unnoticed.

Administrators remove additional organizer access with `POST /api/admin/users/:id/demote-organizer`; student records remain intact. Organizer sessions and face stations check `organizerAccessVersion`, which increments whenever the grant changes. Academic details are editable in Manage Users > View via the admin user PATCH endpoint.

Organizers may edit all event information/status/automation through `canEditEvent`; attendance scope and delete ownership are separate checks. Human edits set server-side latest-editor metadata. Manage Events exposes past events separately.
