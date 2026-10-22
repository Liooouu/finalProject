# Deploying TrackED on Vercel (single container)

This is the no-credit-card deployment used for the thesis data-collection
window. One Vercel container runs the Express API and serves the built React
SPA on the same origin, so the browser keeps using relative `/api` and
`/uploads` URLs.

```
Vercel Container Runtime (root Dockerfile, port 80)
  |-- Express API (/api, /uploads)
  |-- React SPA (frontend-dist, SPA fallback)
  `-- MongoDB Atlas M0
        `-- GridFS bucket "uploads" (profile pictures, face photos, excuses)
```

Uploads live in GridFS, not on the container filesystem. Vercel containers are
ephemeral, so anything written to disk would disappear after a scale-down or
redeploy.

## 1. MongoDB Atlas

1. Create a free **M0** cluster. Choose **AWS / us-east-1** to sit near Vercel's
   default `iad1` region.
2. Create a database user with a strong password.
3. Under **Network Access**, allow `0.0.0.0/0`. Vercel uses dynamic egress IPs;
   a fixed allowlist is not available on the Hobby plan.
4. Copy the Node.js driver connection string and add the database name:

   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/TrackED?retryWrites=true&w=majority
   ```

M0 includes 512 MB of storage shared by documents and GridFS. Check **Atlas >
Database > Storage** during the collection window. Image-heavy excuses and face
photos are the main consumers.

## 2. Vercel project

1. Import the GitHub repository in Vercel.
2. Keep the project root at the repository root. Vercel detects the root
   `Dockerfile` automatically and routes all traffic to the image; no
   `vercel.json` is required.
3. Add these environment variables for **Production** (and Preview if needed):

   | Key | Value |
   |---|---|
   | `MONGO_URI` | the Atlas URI from step 1 |
   | `JWT_SECRET` | a fresh `openssl rand -hex 32` (32+ random bytes) |
   | `JWT_EXPIRES_IN` | `30d` |
   | `ADMIN_EMAIL` | first admin email |
   | `ADMIN_PASSWORD` | strong, unique password |
   | `ADMIN_NAME` | display name, e.g. `System Admin` |
   | `FACE_MATCH_THRESHOLD` | optional, default `0.5` |

   Set `PORT` to `80`, which is what Vercel expects. The image defaults to
   `8080` for OpenShift, so this override is required on Vercel. Do not set
   `TRACKED_NO_AUTO_FREE`; it is baked into the image.

4. Optional mail variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASS`, `SMTP_FROM`, etc.) work only if Vercel allows outbound SMTP.
   Test signup email before relying on it. Without SMTP, verification and
   password-reset email stays disabled.

5. Deploy from the dashboard or with the CLI:

   ```bash
   npx vercel --prod
   ```

   The first boot creates the admin only when `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` are set and no admin exists.

## 3. Keep the app awake

The lifecycle job (`setInterval` in `server.js`) only runs while an instance is
alive. Vercel scales a container down after **5 minutes** without traffic, so
use an external uptime service to request:

```
https://<your-project>.vercel.app/api/health
```

every **4 minutes**. `cron-job.org` and similar free services work. Vercel Cron
on Hobby is not frequent enough for this. Five days of a 2 GB instance kept warm
is roughly 240 GB-hours, below the 360 GB-hour Hobby allowance.

## 4. Verify

1. `GET /api/health` returns `{ ok: true, db: "up", ... }`.
2. Log in as the admin and create an organizer.
3. Upload a profile picture, reload, and confirm it still loads.
4. Enroll a face photo, then test forgot-PIN face recovery.
5. Submit an excuse with an attachment and open it as the organizer/admin.
6. Confirm the image URL is `/uploads/...` and the private face URL is
   `/uploads/private-faces/...` but only readable through
   `/api/account/face/:filename`.

## Limits and risks

- **Request size:** Vercel caps requests at **4.5 MB**; multer rejects files
  over **4 MB**. Keep camera/photo selection compressed.
- **Execution time:** 300 seconds per request on Hobby.
- **Memory/CPU:** 2 GB RAM, 4 CPU-hours active. Face matching is pure-JS CPU
  inference and is the heaviest operation.
- **Storage:** Atlas M0 is 512 MB with 100 ops/sec. GridFS counts against it.
- **Privacy:** Vercel Hobby terms allow content to be used for AI/ML training.
  Do not collect real student biometric photos without consent. Prefer dummy or
  consented data for the thesis demo.
- **SMTP:** outbound SMTP may be blocked. If so, disable email or add an HTTPS
  email provider (for example Resend) behind the existing mailer interface.
- **Old uploads:** files from a previous disk-based deployment are not migrated
  automatically. Re-upload them or import them into the `uploads` GridFS bucket.

## Troubleshooting

**Deployment builds but the site 502s.** Set `PORT=80` in Vercel; the image
defaults to `8080` for OpenShift. Do not use `PORT=5000`.

**`/api/health` says `db: "down"` or the container exits at boot.** Atlas network
access or `MONGO_URI` is wrong. The API exits on a failed initial connection by
design.

**Uploads return 404 after a redeploy.** They are in GridFS, so this usually
means the upload never completed or the database was reset. Check Atlas storage
and the `uploads.files` collection.

**Large uploads return 413.** Vercel rejected the request before Express saw it;
compress the image or reduce the number/size of attachments.

**Face recovery is slow.** Expected on the pure-JS backend. Keep requests under
the 300-second limit and avoid parallel face operations.
