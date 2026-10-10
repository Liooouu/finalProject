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
| `docker compose up --build` | repo root | Local smoke test of both deployment images |

## Tailwind CSS

Uses Tailwind v4 with `@tailwindcss/vite` plugin. No `tailwind.config.js` - styles are in `src/index.css` with `@import "tailwindcss"`.

## Auth Flow

1. Login POST to `/api/auth/login` returns `{ token, role }`
2. Token stored in `localStorage.token`
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. ProtectedRoute checks JWT role before rendering

## Role System

- **student** - Can register, view events, mark attendance
- **organizer** - Created by admin, manages events and attendees
- **admin** - Seeding only, creates organizers

Registration is **student-only**. Organizers must be created by admins.

## API Endpoints

| Route | Auth | Roles |
|-------|------|-------|
| POST /api/auth/register | None | student only |
| POST /api/auth/login | None | all |
| /api/admin/* | Bearer | admin |
| /api/events/* | Bearer | varies |
| /api/account/* | Bearer | all |

## Setup Requirements

- MongoDB must be running at `127.0.0.1:27017`
- Backend `.env` contains `MONGO_URI`, `PORT=5000`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- Run `npm run seed:admin` once to create the first admin account

## Deployment

Deployed on Coolify as **two applications plus a MongoDB service in one
project**: `backend/` and `frontend/`, each built from its own Dockerfile.

- The frontend container serves the SPA with nginx and proxies `/api` and
  `/uploads` to the API over the internal Docker network, so the SPA uses
  **relative URLs** — no `VITE_*` API URL, no CORS.
- The API runs on port 5000 as a non-root user with a volume at
  `/app/uploads`; that volume is the only persistent state outside MongoDB.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` create the first admin on boot, only when no
  admin exists.
- **Deploys are manual.** Redeploy the app whose directory changed with the
  Coolify CLI, which reads its own stored context token:
  ```bash
  coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web  (frontend/)
  coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api  (backend/)
  coolify deploy get <deployment-uuid>           # watch status
  ```
- **Pushing to `main` does not deploy.** The two GitHub Actions workflows
  (`.github/workflows/deploy-*.yml`) are disabled manually, and when run they are
  blocked by Cloudflare's bot protection — GitHub's datacenter runners get an
  HTML block page (Cloudflare error 1010) instead of reaching Coolify, which
  surfaces as `jq: parse error`. GitHub's Git webhook is subject to the same
  block. Do not rely on push-to-`main`; the CLI path above is what works.
- **`docker compose up --build`** at the repo root runs the whole stack locally
  (web on :8080, api on :5000) for testing the real images.

Full instructions, environment variables and troubleshooting:
**`docs/DEPLOY.md`**.

When changing anything that touches URLs or ports, verify it in the containers,
not just with `npm run dev` — that is exactly how the hardcoded
`http://localhost:5000` references in the frontend went unnoticed.
