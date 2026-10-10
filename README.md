# TrackED

Attendance and community-service tracking web app for a school program. Students
register and mark attendance (QR code / face verification); organizers manage
events and attendees; admins manage users and reports. Events move through their
lifecycle automatically (upcoming → live → finished) and absences add community
service hours.

- **Backend** — Express + Mongoose API (`backend/`, port 5000)
- **Frontend** — React 19 + Vite + Tailwind CSS v4 SPA (`frontend/`, port 5173)
- **Database** — MongoDB

For architecture and deployment context see `AGENTS.md` and `docs/`. The frontend
is not served separately in production: each application is built into its own
container and the frontend's nginx proxies `/api` and `/uploads` to the API (see
`docs/DEPLOY.md`).

## Prerequisites

- **Node.js 20.19+ (or 22.12+)** and npm. Vite 7 requires one of these; Node 24
  is known to work.
- **MongoDB** reachable at `127.0.0.1:27017`.
- A **camera** is only needed for the QR scanner and face verification. Browsers
  expose the camera only on a secure context — `http://localhost` counts, so
  local development works; a LAN IP would need HTTPS.

### Start MongoDB

Use a local install, or run one in Docker:

```bash
docker run -d --name tracked-mongo -p 27017:27017 mongo:7
```

## Run the app locally

The backend and frontend run as two dev servers. Use two terminals.

### 1. Backend

```bash
cd backend

# Clean install from the lockfile. Use `npm ci` (not `npm install`): the repo
# still tracks an incomplete node_modules, and `npm ci` replaces it wholesale.
npm ci

# Create the local environment file and fill in a real JWT secret.
cp .env.example .env
openssl rand -hex 32        # paste the output into JWT_SECRET in .env

# Create the first admin account (only needed once).
npm run seed:admin

npm run dev
```

The API listens on <http://localhost:5000>. Check it with
<http://localhost:5000/api/health> → `{"ok":true,"db":"up",...}`.

`npm run seed:admin` creates `admin@tracked.com` / `admin123` when the database
has no admin yet, and does nothing if one already exists. Change that password
after the first login. Alternatively, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
`.env` and the server creates the admin automatically on boot — leave them unset
locally and use the seed command instead.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The web app listens on <http://localhost:5173>. It calls the API and user uploads
with relative URLs (`/api`, `/uploads`), and the Vite dev server proxies those to
the backend on port 5000 — so there is **no API URL to configure** and no CORS to
deal with.

### 3. Log in

1. Open <http://localhost:5173>.
2. Sign in as the seeded admin (`admin@tracked.com` / `admin123`).
3. From the admin dashboard you can create **organizer** accounts. **Students**
   self-register from the login page.

## At a glance

| Service | Command | URL |
|---------|---------|-----|
| Backend API | `npm run dev` in `backend/` | http://localhost:5000 |
| Frontend web | `npm run dev` in `frontend/` | http://localhost:5173 |
| Health check | — | http://localhost:5000/api/health |

## Common scripts

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | `backend/` | Start the API with nodemon |
| `npm run start` | `backend/` | Start the API without watch |
| `npm run seed:admin` | `backend/` | Create the first admin account |
| `npm run dev` | `frontend/` | Start the Vite dev server |
| `npm run lint` | `frontend/` | Run ESLint |
| `npm run build` | `frontend/` | Production build |
| `docker compose up --build` | repo root | Smoke-test the real deployment images (web on :8080, API on :5000) |

## Verifying a change

Manual verification steps for a given change live in that change's **pull request
description** — follow the "How to verify (manual)" section there. As a quick
local check, `npm run lint` and `npm run build` in `frontend/` should pass.

There is no automated test runner in the repository; verification is manual.

## Troubleshooting

- **`Port 5000 is already in use`** — the backend's `dev`/`start` scripts run
  `scripts/free-port.js`, which stops whatever is listening on the port before
  starting. If that fails, stop the process yourself
  (`lsof -ti tcp:5000 | xargs kill -9`) or set `TRACKED_NO_AUTO_FREE=1` to skip
  the automatic stop.
- **API exits with a MongoDB connection error** — MongoDB is not running at
  `MONGO_URI` (default `mongodb://127.0.0.1:27017/TrackED`). Start it and retry.
- **Backend crashes with `Cannot find module './connectionstate'`** (or a similar
  missing-file error) — the repo tracks an incomplete `backend/node_modules`. Run
  `npm ci` in `backend/` to replace it with a complete tree from the lockfile.
- **Camera / QR scanner does nothing** — the page must be a secure context.
  `http://localhost` is fine; opening the app from a LAN IP or plain HTTP is not.
- **Changes to the frontend don't reach the API** — make sure the backend is
  running on port 5000; Vite proxies `/api` and `/uploads` there.

## Deployment

Deploys are **manual**. Redeploy the application whose directory changed — with
the deploy script (waits for the result), or the Coolify CLI directly:

```bash
npm run deploy                                 # both, api first  (also -- web | -- api)
coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web  (frontend/)
coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api  (backend/)
```

Pushing to `main` does **not** deploy: the GitHub Actions workflows are disabled
and GitHub's datacenter runners are blocked by Cloudflare (error 1010). Full
details, environment variables and troubleshooting are in `docs/DEPLOY.md`.
