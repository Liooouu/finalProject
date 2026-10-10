# Deploying TrackED on Coolify

Two applications plus a database, all in **one Coolify project** so the
containers share a Docker network:

```
Cloudflare Tunnel (HTTPS)
  ├── track-ed.vispo.me      → web  (nginx :80)   ─┐
  │                                                 │ browser talks to this
  └── track-ed-api.vispo.me  → api  (node  :5000)   │ origin for everything
                                                    │
web ──proxy /api, /uploads──► api ──► MongoDB service (volume)
                              api ──► /app/uploads  (volume: user files)
```

The `web` container proxies `/api` and `/uploads` to `api` over the internal
network, so the SPA uses relative URLs and CORS never comes into play. The `api`
hostname exists so the API can also be exercised directly (Postman, scripts).

Nothing is built from a repo subdirectory hack: each Coolify application points
at one directory and its own Dockerfile.

## Prerequisites

- Coolify reachable and authenticated, with the GitHub repository connected.
- A Cloudflare Tunnel whose routes you control.
- The API needs **at least 1 GB of memory** — face verification runs
  server-side in pure-JS TensorFlow and is CPU- and memory-hungry.
- `openssl rand -hex 32` (or any secret generator) for the JWT secret.

## 1. Project and database

1. Create a project, e.g. `TrackED`. Both applications **must** live in it.
2. **+ New Resource → Database → MongoDB**, name it `tracked-mongo` (the name
   becomes its internal hostname).
3. Give it a persistent volume (Coolify offers one by default) so the data
   survives redeploys.
4. Note the generated user and password, then build the URI:

   ```
   mongodb://<user>:<password>@tracked-mongo:27017/TrackED?authSource=admin
   ```

   `authSource=admin` is required — Coolify creates the user on the `admin`
   database. `TrackED` is the application database and is created on first use.

## 2. API application

**+ New Resource → Application**, same project. Source: this repository,
branch `main`.

| Field | Value |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/backend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `5000` |
| Domain | `https://track-ed-api.vispo.me` |
| Health check path | `/api/health` (port `5000`) |

**Persistent storage:** one volume mounted at **`/app/uploads`**.

Use a Docker **volume**, not a bind mount. The image runs as the non-root `node`
user (uid 1000) and a fresh Docker volume inherits that ownership, while a bind
mount inherits the host directory's ownership and the API will fail to write
uploads. If you must use a bind mount, `chown -R 1000:1000` the host directory.

**Environment variables:**

| Key | Value |
|---|---|
| `MONGO_URI` | the URI from step 1.4 |
| `JWT_SECRET` | a fresh `openssl rand -hex 32` output |
| `JWT_EXPIRES_IN` | `30d` |
| `PORT` | `5000` |
| `TRACKED_NO_AUTO_FREE` | `1` |
| `ADMIN_EMAIL` | e.g. `admin@vispo.me` |
| `ADMIN_PASSWORD` | a strong, unique password |
| `ADMIN_NAME` | e.g. `System Admin` |

The API creates the admin account on first boot **only when `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are both set**, and only if no admin exists yet. Restarts and
redeploys are safe: it never touches an existing admin account, and it refuses
to promote an unrelated account that happens to own that email address.

## 3. Web application

**+ New Resource → Application**, same project, same repository and branch.

| Field | Value |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/frontend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Domain | `https://track-ed.vispo.me` |

**Environment variables:**

| Key | Value |
|---|---|
| `BACKEND_URL` | `http://tracked-api:5000` |

Set this to `http://` + the API application's **name** in Coolify + `:5000`. No
trailing slash. If the name differs, this one variable is the only change
needed — restart the container, no rebuild. If the API name ever changes,
double-check here.

No `VITE_*` variables exist on purpose: the SPA calls `/api` and `/uploads`
relatively and nginx forwards them.

## 4. Cloudflare Tunnel

Add both routes once Coolify has deployed and reported the assigned ports:

| Public hostname | Service |
|---|---|
| `track-ed.vispo.me` | `http://<coolify-host>:<web-port>` |
| `track-ed-api.vispo.me` | `http://<coolify-host>:<api-port>` |

HTTPS is not optional here — the attendance and face-enrolment screens use
`getUserMedia`, which browsers only expose on a secure context.

## 5. First-deploy checklist

1. Both applications report **Running / Healthy**.
2. `https://track-ed-api.vispo.me/api/health` → `{"ok":true,"db":"up",...}`.
3. `https://track-ed.vispo.me` → the login screen, no console errors.
4. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then change that password.
5. Hard-refresh a deep link (`/admin/dashboard/users`) — it must render, not 404.
6. Upload a profile picture, then reload: the image must come back through
   `/uploads`, proving both the proxy and the volume.
7. As a student, enrol a face and verify cameras work over HTTPS.

## Redeploying

Pushing to `main` deploys automatically (see below). You can also click Redeploy
in Coolify, or run `scripts/deploy.sh` by hand.

The database and the uploads volume are untouched by a rebuild.

Both applications are independent: a frontend-only change still requires a
frontend rebuild, because the SPA is baked into its image.

## Continuous deployment on push to `main`

Two workflows deploy the half of the repository that changed:

| Workflow | Trigger | Deploys |
|---|---|---|
| `.github/workflows/deploy-api.yml` | push to `main` touching `backend/**` | `tracked-api` |
| `.github/workflows/deploy-web.yml` | push to `main` touching `frontend/**` | `tracked-web` |

Both call `scripts/deploy.sh`, which triggers the Coolify deployment and polls
until it finishes — so a failed deployment turns the workflow red instead of
failing silently. Either can also be started by hand from the Actions tab.

**Required repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `COOLIFY_URL` | the Coolify base URL, e.g. `https://coolify.example.com` — no trailing slash |
| `COOLIFY_TOKEN` | a Coolify API token with the **deploy** ability |

Until those exist, nothing fails: `scripts/deploy.sh` detects that it is running
in CI without credentials, prints a warning and skips the deployment.

Create a **dedicated** token for this (Coolify → Keys & Tokens) instead of
reusing a personal one. It lives in GitHub's encrypted secrets, but its blast
radius should still be "can deploy", and nothing more.

### Deploying by hand

```bash
COOLIFY_URL=https://coolify.example.com COOLIFY_TOKEN=... scripts/deploy.sh api
COOLIFY_URL=https://coolify.example.com COOLIFY_TOKEN=... scripts/deploy.sh all
```

It prints each status change and exits non-zero on failure. Deployment **logs**
are only available in the Coolify UI unless the token also carries
`read:sensitive`; on failure the script prints a link to the right page.

### Why not let Coolify watch the repository instead?

Coolify can deploy on push through a GitHub App or a repository webhook, which
is tidier when the repository owner can install it. This repository is public
with no GitHub App integration, and creating a webhook needs admin permission on
the repository. The workflows above need neither, and they keep the deploy logic
in the repository where it can be reviewed.

## Troubleshooting

**`web` returns 502 and the API is healthy.** `BACKEND_URL` is wrong, or the two
apps are not in the same project. Check from inside the container:
`docker exec <web-container> getent hosts tracked-api`.

**Uploads disappear after a redeploy.** The volume is missing or mounted at the
wrong path; it must be exactly `/app/uploads`. A bind mount with wrong
ownership looks similar — see the note in step 2.

**Deep links 404 but `/` works.** The nginx template did not render; check
`/etc/nginx/conf.d/default.conf` inside the container. It must contain the
`try_files $uri $uri/ /index.html;` block.

**The API container restarts at boot.** `config/db.js` exits the process when
MongoDB is unreachable, so the database must be up first. Coolify usually orders
this correctly; if it recurs, add `restart: unless-stopped` behaviour by
redeploying once the database has settled.

**Camera "can't reach a camera" messages.** The page is not on HTTPS.

**Face verification feels slow.** Expected: it is pure-JS CPU inference, in the
seconds per attempt. It is fast enough to be usable but scales with CPU, so
keep the memory limit up and don't run other heavy workloads on the same host.

## Known gaps

- **No rate limiting on login.** The API is publicly reachable now; a Cloudflare
  Access policy or a rate-limit rule on `/api/auth/` is the cheap mitigation.
- **CORS is wide open** (`cors()` with no origin allowlist). Harmless for the
  browser flow, which stays same-origin through nginx, but it is not a control.
- **`JWT_SECRET` history.** The old placeholder value is still in this
  repository's git history; the deployment secret must be a **new** value, or
  old tokens signed with it remain forgeable.
- **Uploads live only on the volume**, not in object storage. Back up that
  volume along with the database.
