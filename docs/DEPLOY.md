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

Deploys are **manual**. Redeploy the application whose directory changed with the
Coolify CLI, which reads its own stored context token (check the target with
`coolify context list` — this project uses the `coolify` context,
`http://192.168.0.125:8000`):

```bash
coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web  (frontend/ changes)
coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api  (backend/ changes)

coolify deploy get <deployment-uuid>           # watch until status is "finished"
```

The Coolify UI's **Deploy** button and the deploy API (below) work too. The
database and the uploads volume are untouched by a rebuild.

## Push-to-deploy (configured, currently not working)

As of 2026-10-10, **pushing to `main` does not deploy.** Two independent triggers
are configured, and the same obstacle defeats both: Cloudflare's bot protection
answers GitHub's datacenter runners with an HTML block page (**Cloudflare error
1010**) instead of forwarding the request to Coolify.

1. **GitHub Actions workflows** — `.github/workflows/deploy-api.yml` and
   `deploy-web.yml` each deploy only the app whose directory changed, using the
   `COOLIFY_URL` and `COOLIFY_TOKEN` repository secrets. They are currently
   **disabled manually**, and when dispatched they fail with `jq: parse error`
   (the HTML block page). Re-enabling them changes nothing until a runner can
   actually reach Coolify (a self-hosted runner, or a tailnet route).
2. **A manual Git webhook** from GitHub to Coolify — described below. One webhook
   serves both applications: Coolify matches a delivery by repository and branch,
   so a push to `main` would redeploy `tracked-api` and `tracked-web` together.
   It is configured and works from a signed request on the LAN, but a delivery
   coming from GitHub is subject to the same Cloudflare block.

Until this is resolved, use the manual path in **Redeploying** above.

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

This is the expected outcome today — both triggers above are blocked; use the
manual path in **Redeploying** first. To diagnose the webhook itself:

1. **GitHub → Settings → Webhooks → Recent Deliveries.** A 2xx response means
   delivery worked, so look at Coolify's deployment history next. A Cloudflare
   block page (403, or `error code: 1010`) means Cloudflare's bot protection is
   refusing GitHub's datacenter IPs. No Coolify setting can fix that: the traffic
   has to arrive by another route, such as a self-hosted runner or joining a
   tailnet before calling Coolify.
2. **The secret must match exactly** in both Coolify applications and in GitHub.
3. **Coolify → app → Advanced → Deployment → Auto deploy** should be *Deploy on
   push (webhooks)*. Both applications here deployed from a signed webhook with
   this left at its default, so it may already be effective — check it first if a
   correctly signed delivery is accepted but nothing builds.
4. **The branch must be `main`**, and the repository and branch must match the
   application's configuration; that is how Coolify picks which app to deploy.

### Deploying by hand

The verified path is the Coolify CLI, which uses its own stored context token so
nothing needs to be pasted:

```bash
coolify deploy uuid wch2xf2obvaazogtim1advqu   # tracked-web
coolify deploy uuid eflvv8s2turwoceyhqwidt5z   # tracked-api
coolify deploy get <deployment-uuid>           # queued → in_progress → finished
```

You can also press **Deploy** in the Coolify UI, or use the deploy API directly:

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
