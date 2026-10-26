# Deploying TrackED on Coolify

> For the no-credit-card Vercel container + Atlas deployment, see
> [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md).
>
> Uploads are now stored in MongoDB **GridFS**. The `/app/uploads` volume and
> uploads-volume backup steps below are legacy; MongoDB backups cover uploads.

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

**Email notifications + signup verification (optional):**

Set these to also email event notifications to the address each user registered
with, and to make new students **verify their email with a 6-digit code** before
their account is active. Use a Gmail account with **2-Step Verification on** and
an **App Password** (Google Account → Security → App passwords). While they are
unset, notifications stay in-app only, signups skip the verification step, and
the API logs no mail.

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | the sending Gmail address |
| `SMTP_PASS` | its 16-character App Password |
| `MAIL_FROM` | `TrackED <the sending Gmail address>` |
| `APP_URL` | `https://track-ed.vispo.me` (used in the email's button) |

> **In-app override:** an admin can later edit SMTP settings and the email
> texts from **Admin Portal → Email Settings** (`/admin/dashboard/settings/email`).
> Values saved there are stored in the database (password encrypted at rest)
> and take precedence over these environment variables, which act as the
> fallback until the page is used. A **Send Test** button on the page verifies
> the configuration without waiting for a real notification.

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
| `VITE_GOOGLE_MAPS_EMBED_KEY` | *(build-time, optional — see below)* |

`BACKEND_URL`: `http://` + the API application's **name** in Coolify + `:5000`. No
trailing slash. If the name differs, this one variable is the only change
needed — restart the container, no rebuild. If the API name ever changes,
double-check here.

`VITE_GOOGLE_MAPS_EMBED_KEY` is an **optional** build variable, not a runtime
one: Vite inlines it during `npm run build`, so set it under the app's build
settings and **rebuild** after changing it. The event map's *Get directions*
and *Street View* buttons open in-app dialogs whether or not it is set: without
it they use Google's keyless embed URLs (Street View's is unofficial), with it
they use the official Maps Embed API, which is more reliable. It is the only
`VITE_*` variable and it is public (baked into the bundle), so restrict it
in Google Cloud: Application restriction = **HTTP referrers** (add
`https://track-ed.vispo.me/*` and `http://localhost:5173/*`), API restriction =
**Maps Embed API only**. Creating it needs a Google Cloud project with billing
enabled, though Embed API usage itself is free and unlimited. See
`frontend/.env.example`.

Otherwise the SPA calls `/api` and `/uploads` relatively and nginx forwards them
— no runtime `VITE_*` variables exist.

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
2. `https://track-ed-api.vispo.me/api/health` → `{"ok":true,"db":"up",...}`. Its
   `mail` field reads `"on"` once the SMTP variables below are set, `"off"`
   otherwise — a quick way to confirm email is wired up on the API.
3. `https://track-ed.vispo.me` → the login screen, no console errors.
4. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then change that password.
5. Hard-refresh a deep link (`/admin/dashboard/users`) — it must render, not 404.
6. Upload a profile picture, then reload: the image must come back through
   `/uploads`, proving both the proxy and the volume.
7. As a student, enrol a face and verify cameras work over HTTPS.

## Redeploying

Deploys are **manual**. Redeploy the application whose directory changed — two
equivalent paths, both driving the Coolify CLI (it reads its own stored context
token, so no token lives in this repository):

```bash
# Option 1 — the deploy script (triggers and waits for the result)
npm run deploy                 # both, api first
npm run deploy -- web          # tracked-web  (frontend/ changes)
npm run deploy -- api          # tracked-api  (backend/ changes)

# Option 2 — the CLI directly
coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web
coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api
coolify deploy get <deployment-uuid>           # watch until status is "finished"
```

The CLI context is `coolify` → `http://192.168.0.125:8000`; check it with
`coolify context list`. The Coolify UI's **Deploy** button and the deploy API
(below) work too. The database and the uploads volume are untouched by a rebuild.

## Push-to-deploy (working)

Since 2026-10-26, **pushing to `main` deploys.** The two GitHub Actions workflows
are the primary trigger:

1. **GitHub Actions workflows** — `.github/workflows/deploy-api.yml` and
   `deploy-web.yml` each deploy only the app whose directory changed
   (`backend/**` → `tracked-api`, `frontend/**` → `tracked-web`), using the
   `COOLIFY_URL` and `COOLIFY_TOKEN` repository secrets. They are **active**, call
   the authenticated deploy API (`POST /api/v1/deploy?uuid=…`), and wait for the
   deployment to finish. A push that touches neither directory deploys nothing.
2. **A manual Git webhook** from GitHub to Coolify — kept as a **fallback**. One
   webhook serves both applications: Coolify matches a delivery by repository and
   branch, so a push to `main` would redeploy `tracked-api` and `tracked-web`
   together. Because the Actions workflows are the primary trigger, each app's
   **Auto deploy** is set to **Manual deployments only**, so the webhook does not
   also fire (double deploy). To use the fallback, switch Auto deploy back to
   *Deploy on push (webhooks)*.

The webhook payload settings (fallback only), for reference:

| Setting | Value |
|---|---|
| Payload URL | `https://coolify.vispo.me/webhooks/source/github/events/manual` |
| Content type | `application/json` |
| Events | *Just the push event* |
| Secret | at least 16 characters, saved in **each** application's Webhooks tab |

Store the **same** secret in both applications (Coolify → app → Webhooks →
Manual Git Webhooks → GitHub); that is what lets a single repository webhook
cover both. GitHub's servers have to reach Coolify to deliver the webhook, so the
Coolify instance must stay reachable from the public internet.

The SPA is compiled into the `tracked-web` image, so a frontend change needs that
app's rebuild — the same webhook handles it.

### If a push does not deploy

1. **GitHub → Actions.** Confirm the right workflow ran and its "Trigger the
   Coolify deployment" step succeeded. A `jq: parse error` there means the runner
   did not receive JSON from Coolify — almost always a Cloudflare challenge
   (`403`, `cf-mitigated: challenge`), not a Coolify error. Check that **Bot Fight
   Mode is off** for the `vispo.me` zone; Configuration Rules cannot skip it.
2. **The secret must match exactly** in both Coolify applications and in GitHub.
3. **If using the webhook fallback**, set Coolify → app → Advanced → Deployment →
   **Auto deploy** to *Deploy on push (webhooks)*. It is deliberately *Manual* now
   so the Actions path is the only trigger; a correctly signed delivery is
   accepted but builds nothing while it stays *Manual*.
4. **The branch must be `main`**, and the repository and branch must match the
   application's configuration; that is how Coolify picks which app to deploy.

### Deploying by hand

**Option 1 — the deploy script.** `npm run deploy` (root `scripts/deploy.mjs`)
triggers the build(s) and waits, printing each status change:

```bash
npm run deploy                 # both applications, api first
npm run deploy -- api          # tracked-api only  (backend/)
npm run deploy -- web          # tracked-web only  (frontend/)
npm run deploy -- --dry-run    # preflight checks only
```

It drives the `coolify` CLI (which uses its own stored context, so no token lives
in this repository), refuses to run while you have unpushed commits — Coolify
builds the remote branch — exits non-zero when a deployment fails, and points at
the deployment page in the Coolify UI.

**Option 2 — the `coolify` CLI directly.** Same mechanism, no repo tooling:

```bash
coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web
coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api
coolify deploy get <deployment-uuid>           # queued → in_progress → finished
```

Deploy only the application whose directory changed: they are independent builds,
and a frontend change never requires rebuilding the API.

You can also press **Deploy** in the Coolify UI, or call the deploy API directly:

```bash
# queues a deployment; poll /api/v1/deployments/<deployment-uuid> for its status
curl -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/deploy?uuid=<app-uuid>"
```

Application UUIDs: `tracked-api` = `eflvv8s2turwoceyhqwidt5z`,
`tracked-web` = `wch2xf2obvaazogtim1advqu`.

The deploy webhook needs a Coolify API token with the **`deploy`** permission
(Coolify → Keys & Tokens → API tokens). Take `deploy` only: Coolify's docs
describe it as deploying "restarts, stops, cancellations, and deploy webhooks",
and selecting it creates a deploy-only token. `root` is unnecessary, and
`read:sensitive` is only needed to read logs and secrets. The token is bound to
the team that created it, and its owner must be a team administrator or owner.

Deployment **logs** require `read:sensitive`, so failures are easiest to inspect
in the Coolify UI.

## Temporary Oracle Cloud deployment

Use this stack when Coolify or its Cloudflare Tunnel is unavailable. It runs the
same API, web and MongoDB images on one always-on VM, with Caddy terminating
HTTPS. Only Caddy publishes ports; MongoDB, the API and the web container stay
on the internal Docker network.

Files:

- `docker-compose.prod.yml` — production services and named volumes.
- `deploy/Caddyfile` — automatic HTTPS for `${DOMAIN}`.
- `deploy/.env.prod.example` — environment template; copy to
  `deploy/.env.prod` (ignored by git).

1. Create an Oracle `VM.Standard.A1.Flex` instance with 2 OCPUs, 12 GB RAM,
   Ubuntu and a 50–100 GB boot volume in the tenancy's home region. Reserve a
   public IPv4 address.
2. Open TCP `22` from your IP and TCP `80`/`443` from the internet in the VCN
   security list, then allow the same ports in the VM firewall.
3. Install Docker and Docker Compose.
4. Point a DuckDNS hostname at the VM's public IP.
5. Copy the current working tree to `/opt/tracked` on the VM. The production
   stack builds the images on the VM; `node_modules` and `dist` are not needed.
6. Create `deploy/.env.prod` from the example and set `DOMAIN`, `JWT_SECRET`,
   the admin credentials and anything else you need. `MONGO_URI` stays
   `mongodb://mongo:27017/TrackED` because MongoDB is internal.
7. Build and start:

   ```bash
   docker compose --env-file deploy/.env.prod \
     -f docker-compose.prod.yml up -d --build
   ```

8. Confirm `https://${DOMAIN}/api/health` reports `"db":"up"`, log in, upload a
   profile picture, complete a face enrollment and test an event lifecycle.

### Migrating existing data

If the old host is reachable on its LAN, dump its MongoDB and uploads volume
before starting the new database:

```bash
# On the old host: adjust the container and volume names.
docker exec <mongo-container> mongodump --db TrackED --archive=/tmp/tracked.gz --gzip
docker cp <mongo-container>:/tmp/tracked.gz ./tracked.gz
docker run --rm -v <uploads-volume>:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /data .
```

Restore the archive into the new MongoDB, extract `uploads.tar.gz` into the
`uploads` volume, and set ownership to the API user:

```bash
docker exec -i <new-mongo-container> mongorestore --gzip --archive < tracked.gz
```

The API runs as uid `1000`; a bind-mounted uploads directory may need
`chown -R 1000:1000`. A Docker volume created by this compose file already has
the correct ownership.

### Backups

Back up both the database and uploads volume daily, and keep a copy off the VM:

```bash
docker exec <mongo-container> mongodump --db TrackED --archive=/tmp/tracked.gz --gzip
docker cp <mongo-container>:/tmp/tracked.gz ./backups/tracked-$(date +%F).gz
docker run --rm -v tracked_uploads:/data -v "$PWD/backups":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Always take a backup before a rebuild or restore. Oracle may reclaim idle
Always Free compute instances, so a backup that exists only on the VM is not
enough.

### Security notes

- Do not publish MongoDB (`27017`) or the API (`5000`) directly.
- `deploy/.env.prod` contains the JWT secret, admin password and SMTP password;
  it must stay out of git.
- HTTPS is mandatory for the camera-based attendance and face-enrollment
  screens.

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
