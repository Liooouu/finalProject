# Deploying TrackED on OpenShift Developer Sandbox

The Developer Sandbox is free and does not require a credit card. It provides
one project with roughly **3 CPU cores, 14 GB RAM, 40 GB storage, and 30 days**
of access. Pods are recycled after long runtimes, so the app must keep no local
state. TrackED stores uploads in MongoDB Atlas GridFS, which satisfies that.

The root `Dockerfile` builds one container that serves both the Express API and
the React SPA on port `8080`. All browser URLs stay relative (`/api`,
`/uploads`), and the OpenShift route provides HTTPS for the camera features.

## 1. Accounts

1. Create or sign in to a Red Hat Developer account and start the
   **Developer Sandbox** at `https://developers.redhat.com/developer-sandbox`.
2. Wait until the sandbox is provisioned.
3. Create a free **MongoDB Atlas M0** cluster:
   - AWS / `us-east-1`
   - A database user with a strong password
   - Network Access: `0.0.0.0/0` (OpenShift egress IPs are dynamic)
   - Connection string with the database name:
     `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/TrackED?...`

M0 has 512 MB shared by documents and GridFS. Face photos and excuse
attachments count against that quota.

## 2. Install and log in

```powershell
winget install --id RedHat.OpenShift-Client -e
oc login --token=<token-from-sandbox> --server=<sandbox-api>
oc project <sandbox-namespace>
```

The token is personal; do not commit it or paste it into chat. `oc login`
stores the session under `~/.kube/config`, so later commands work without it.

## 3. Build from Git

Push `main` first. Then, from the repository root:

```powershell
oc new-build --name=tracked --strategy=docker https://github.com/Liooouu/finalProject.git
oc start-build tracked --follow
```

OpenShift auto-detects the root `Dockerfile`. The build installs backend
dependencies, builds the frontend, and copies `frontend/dist` to
`/app/frontend-dist`.

If a build is already configured:

```powershell
oc start-build tracked --follow
```

## 4. Deploy

```powershell
oc new-app --image-stream=tracked --name=tracked
oc expose svc/tracked --port=8080
```

Check the route:

```powershell
oc get route tracked -o jsonpath="{.spec.host}"
```

The route uses HTTPS. Open it and confirm the SPA loads.

## 5. Secrets

Create a temporary env file outside the repository:

```text
MONGO_URI=mongodb+srv://...
JWT_EXPIRES_IN=30d
JWT_SECRET=<output of a random 32-byte hex generator>
ADMIN_EMAIL=<first admin email>
ADMIN_PASSWORD=<strong unique password>
ADMIN_NAME=System Admin
```

Then create the secret and bind it:

```powershell
oc create secret generic tracked-secrets --from-env-file=$env:TEMP\tracked-openshift.env
oc set env deployment/tracked --from=secret/tracked-secrets
```

Delete the temporary file after the secret is created. The first pod boot
creates the admin only when no admin exists and both admin variables are set.

Do **not** put these values in `vercel.json`, `Dockerfile`, or Git.

## 6. Resources and probes

```powershell
oc set resources deployment/tracked --requests=cpu=250m,memory=512Mi --limits=cpu=1,memory=2Gi
oc set probe deployment/tracked --readiness --get-url=http://:8080/api/health --initial-delay-seconds=20 --period-seconds=10
oc set probe deployment/tracked --liveness --get-url=http://:8080/api/health --initial-delay-seconds=40 --period-seconds=30
```

The API needs headroom for the pure-JS face matcher. `2Gi` is enough for normal
use; do not run parallel face verifications.

## 7. Verify

1. `GET /api/health` returns `{ ok: true, db: "up", ... }`.
2. Log in as the admin and create an organizer.
3. Upload a profile picture, reload, and confirm it still loads.
4. Enroll a face photo, then test forgot-PIN face recovery.
5. Submit an excuse with an attachment and open it as the organizer/admin.
6. Request `/uploads/private-faces/<name>` directly; it must return `404`.
7. Open a deep link such as `/dashboard`; the SPA fallback must render.

## 8. Keepalive

The lifecycle job runs in-process. Use an external service to request
`https://<route>/api/health` every 4–5 minutes:

- A GitHub Actions scheduled workflow, or
- `cron-job.org` / UptimeRobot.

The sandbox can recycle pods after long runtimes and expires after 30 days.
Atlas data survives; re-create the sandbox or import the resources if the trial
ends during the collection window.

## Limits and risks

- **30-day sandbox.** Back up Atlas and export OpenShift resources before expiry.
- **Pod recycling.** A new pod starts automatically, but expect a short cold
  start. The keepalive ping reduces surprises.
- **Atlas M0:** 512 MB and 100 ops/sec.
- **SMTP:** the sandbox may block outbound SMTP. Test signup email; if blocked,
  disable mail or use an HTTPS provider such as Resend.
- **No persistent volume needed.** Uploads are in GridFS. Do not add disk-based
  uploads back without a PVC.
- **Biometric data:** use dummy or consented data for the thesis demo and keep
  the Atlas project access limited.

## Troubleshooting

**Build cannot find the Dockerfile.** Confirm the repository root contains
`Dockerfile` and that the BuildConfig has no stale `dockerfilePath`.

**Build succeeds but the route returns 503.** Check `oc get pods` and
`oc logs deployment/tracked`. The API exits at boot when `MONGO_URI` is wrong or
Atlas rejects the sandbox IP.

**Route points at the wrong port.** The container and service must use `8080`.
`oc expose svc/tracked --port=8080`.

**Uploads 404 after a redeploy.** Files are in Atlas GridFS, so check the
`uploads.files` collection and Atlas storage instead of the pod filesystem.

**Large uploads fail.** OpenShift and Atlas have their own limits; keep images
small. The API accepts files up to 4 MB each.
