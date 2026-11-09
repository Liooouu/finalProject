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

## Frontend Performance

- **Fonts are self-hosted.** Inter and Inter Tight (variable, latin + latin-ext) live in `frontend/src/assets/fonts` and are declared in `frontend/src/styles/fonts.css`. Nothing loads from `fonts.googleapis.com`; keep it that way when adding a family.
- **`frontend/src/utils/queryCache.js`** is a small in-memory, account-scoped cache. Screens seed their state from `readScreen(key)` and write it back after each fetch, so revisiting a tab paints instantly and refreshes silently. Nothing is persisted, so a reload never shows stale data.
- **`useAutoRefresh`** defaults to 10 s. List screens pass `{ interval: 30000 }`; live attendance screens keep the short beat.
- **`frontend/src/utils/prefetchRoutes.js`** warms a portal's page chunks on nav hover and during browser idle (skipping data-saver/2G and the 190 KB report). It must never prefetch `/check-in/:token` — that kiosk chunk is 1.3 MB.
- Do not add `backdrop-blur` to the sticky bars or animated/filtered layers behind the full-screen grain overlay; both forced whole-page recomposites.

## API Performance

- `server.js` runs `compression()`. nginx also gzips static assets; woff2 must not be gzipped.
- `GET /reports/attendance` returns a **window** of records (`limit`, default 10, max 200) plus totals from aggregation — `stats.total` is the full count, not `records.length`. Pass `?studentId=` for a single student's ledger.
- `GET /reports/events` counts attendance with one grouped aggregation, not a query per event.

## Auth Flow

1. Login POST to `/api/auth/login` returns `{ token, role }`
2. Token stored in `localStorage.token`
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. ProtectedRoute checks JWT role before rendering
5. Student login/signup continues to attendance face enrollment when not enrolled. No security PIN or trusted-device challenge is used. Email verification and Forgot Password use one-time email codes.

## Role System

Uploaded face enrollment uses pending FaceAppeal requests and admin-only activation. Keep Use camera and Upload photo available after consent in onboarding/Profile > Security. Gallery upload is enrollment-only, not attendance. Admin Face Appeals uses six requests per page, page-local Select all for pending enrollment uploads, identity confirmation before approval and a rejection reason. Preserve newer enrollments and retry-safe review receipts. See docs/UPLOADED_FACE_ENROLLMENT.md.

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
- SMTP is maintained in the API hosting environment, not an admin profile. Complete environment credentials override the legacy saved transport as one unit; legacy settings are read-only migration fallback. Restart the API after environment changes. Keep production `APP_URL` public and HTTPS. See `docs/EMAIL.md` for the maintainer file map and delivery diagnostics.
- Run `npm run seed:admin` once to create the first admin account

## Deployment

Deployed on Coolify as **two applications plus a MongoDB service in one
project**: `backend/` and `frontend/`, each built from its own Dockerfile.
There is also an optional **single-container deployment** (root `Dockerfile`)
that serves the SPA and API together. The default port is `8080`; other hosts
can override `PORT` (see `docs/DEPLOY_VERCEL.md`). The active production site
uses the separate Coolify web and API applications described below.

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

Academic year advancement is administrator-confirmed in Manage Users > Year levels. Do not advance students during login, profile reads, startup, or timers. The saved AcademicAdvancement roster covers all pages, with searchable retained-year exceptions and explicit fourth-year graduation selections. Per-student atomic updates preserve academicHistory and record academicTransitions; a target-year guard and saved batch choices make retries idempotent. See docs/ACADEMIC_UPDATES.md. Event create/edit schedules must use real dates from January 1, 2026 onward; both the shared form/editor and services/eventSchedule.js enforce this floor.

The advancement tab loads available classes for the current school year. Use one name/email search plus separate Program (BSIT/BSCS/BSEMC), Year level (1–4) and Section filters. Search works across eligible students before class selection. Complete class filters automatically preview only that class (a sole available class is auto-filled); partial filters are read-only. API previews require a validated classScope saved with the batch and history; preserve old batches and Undo. Loading/refreshing must never confirm a batch. Exception selections survive refresh for remaining students. Individual academic edits and organizer grants/removals remain in the existing user details dialog.

Saved academic results use the original batch snapshots, not a fresh eligible-class query. Keep per-student previous/new year, outcome and undo status in five-row pages, opened through an eye icon in a results dialog. Keep compact summaries/history visible after confirmation and reload; do not auto-open a results dialog after confirmation. `/:id/results` is admin-only and read-only. Preserve the selected result in the tab URL; The eye action opens saved results. Fully undone updates are hidden from the history list; partial/retrying undos remain visible. Keep the internal batch and transition audit. Closing the dialog removes only the selected-result URL parameter, not its saved data.

Academic advancement supports administrator-confirmed `/:id/undo` and paginated `/history`. Restore only this batch's saved academic standing; skip changed academic fields and newer active transitions. Atomic student writes protect racing edits; keep transitions with revertedAt/revertedBy and remove only batch-tagged academicHistory entries. Repeated/partial undo is retryable. An undone batch cannot be confirmed again; the target-year guard ignores reverted transitions so a fresh reviewed batch can advance restored students. Do not rewrite attendance, service hours, face data, or organizer access during undo. `/:id/undo-preview` identifies only exact prior-standing records with unfinished school-year/audit rollback. Finish undo requires explicit confirmation of those IDs; revalidate current standing and latest transition atomically, never force other academic edits. Restored results show the restored year, not the original target as the current result.

Organizers may edit all event information/status/automation through `canEditEvent`; attendance scope and delete ownership are separate checks. Human edits set server-side latest-editor metadata. Manage Events exposes past events separately.

Organizers collaborate on attendance across all events, including events created by another organizer or an administrator. The dashboard and manual attendance event lists use `/api/events/all`; `/api/events/my-events` remains the explicit creator-only filter. `canViewEventAttendance` permits organizer/admin monitoring, and `canRecordAttendance` permits organizer-only entry and face-station creation. Event deletion remains creator/admin-only. Shared stations still record the actual `openedBy` account and grant version; demotion invalidates that operator's sessions.

Manual attendance and status corrections now use `/api/manual-attendance/requests` and require independent review. Direct legacy manual/status/organizer-hour endpoints return 409. Live requests use immutable server check-in time; documented historical corrections use a separately claimed time. Present/late and 0/4 penalty hours are calculated from the saved attendance-window snapshot, never the approval time. Only administrators or current, explicitly assigned event reviewers may approve; a requester or beneficiary cannot review their own request. Review batches check each selected request. Admins retain monitoring/review rather than direct check-in entry; administrators still handle separate service-ledger adjustments. `ManualAttendanceRequest` stores decisions and `Attendance.manualAttendanceAudit` records the applied change. Pending auto-absence penalties are provisional in read projections and excluded from student balance until decided. Requests do not replace face-verified attendance or approved excuses. Pending requests block event/participant deletion, and organizer demotion removes event reviewer assignments. No extra base role or public admin registration was added.

If a face check-in subsequently records the same Present/Late result as a pending manual request, independent approval finalizes only the request with resolution=existing_face and a confirmedAttendance snapshot. Keep the entire Attendance document, original face time, biometric/session evidence, and adjusted service hours unchanged. A differing face status or approved excuse remains protected and is shown on the review card, with an explicit conflict message. Repeated approvals return the saved resolution. Never count the matching face record as a second manual attendance entry.

Responsive attendance layouts stack form/action cards on phones and keep compact student metrics side by side. Admin Manage Events uses three events per page with a stable pagination footer; organizer event lists retain two per page. Manual requests are reachable through sidebar/mobile drawer navigation, with dashboard pending counts and student request history in the service ledger.

Pagination footers must follow their content in normal flow, never cover event/card actions with sticky positioning. `StablePage` uses natural content height and preserves the clicked pager's screen position through scroll adjustment where possible. Do not reserve previous-page height or stretch individual records to fill missing rows. Give `pageKey` the filter/search scope, not the page number; pass `loading` for server-paginated lists. Dashboard rows keep natural heights; pagination follows the visible records. Admin and organizer event grids keep the same column widths on one/two-card final pages and show all actions above the footer. Admin event lists also use StablePage to preserve pagination position when description lengths change. Student ledger pagination belongs below its records. The admin dashboard is a launcher — attendance-rate card, review queues and a three-event preview with no pager; attendance records and bulk deletion stay on Reports.

Long record lists use pagination with a maximum of five records per page across portals. Keep the existing smaller one/two/three-event or letter pages. Manage Users is one account directory (administrators, organizers and students together) with a role filter, not two independent lists: one page of five accounts, no fixed-height internal vertical scrolling, and search plus the filter reset that single page. Notifications, recent activity, ledger history, report ledgers, manual-review records, face appeals, bulk rosters and review exceptions use five-record pages. Filters, totals, exports and batch selections operate on the full matching dataset, not only visible rows. Page scroll and necessary small-screen form/dialog scroll remain available; do not replace native selects or horizontal table scrolling with record pagination.

Security/registration: student self-registration and email verification support Objective 3.1. Do not add official CCIT masterlist matching/import or Google sign-in without a new explicit scope decision. Registered-account lists for reviewed academic advancement remain in scope under Objective 1.1; they are not registrar data. Email ownership alone does not prove department membership. Keep existing accounts usable. Production signup and explicit email verification fail closed when mail is unavailable. sessionVersion revokes JWTs and station authorization after password changes. New stations require their issuing browser's HttpOnly cookie; no head-turn challenge is used. New session-based events require separate Time In and Time Out; legacy events remain Time In-only. The user explicitly chose a fast organizer-supervised scanner with photo/video spoofing risk acknowledged. Same-identity face updates stay self-service; mismatches require the existing Face Appeal replacement grant, school-ID attestation, matching approved proof, a seven-day deadline and the original enrollment version. Never expose replacementDescriptor. Use activeStudentFilter/isActiveStudent for new attendance/penalty eligibility; preserve historical graduate records. Public uploads are referenced profile pictures only; attachments use authenticated owner/staff fileRoutes and PrivateAttachment, while face photos use the authenticated face reader. Both account-delete endpoints share deleteAccount. See docs/SECURITY_AND_REGISTRATION.md.

Year-level selections are positive: checked students advance/graduate; unchecked students receive no academic write at all. Check all spans the entire selected class, regardless of search/page. New previews start unchecked; refresh retains the selection. Persist selectedIds for retries; reject empty/foreign/changed selections. Legacy batches without selectedIds keep their original behavior.

UI consistency: shared Pagination uses fixed control columns, tabular counts, and no hover translation. Portal main scroll containers disable browser overflow anchoring so StablePage owns pager scroll adjustment. Keep AttendanceRecordActions mounted across pagination; pass scopeKey to clear page selections without losing the pager anchor. ReportDonut owns separate chart/center/legend tracks for attendance, events, and user reports; stack the legend at narrower widths. Student event details use fixed icon columns and wrapping values.

For equal-height adjacent paginated cards, use a flex-column card and StablePage fill: the footer consumes remaining space with margin-top:auto, so a short final page keeps its controls at the card bottom. Keep records natural height; do not add blank table rows or carry measured page heights across navigation. Single-page lists still hide navigation.

Reviews navigation: admin and organizer use one Reviews sidebar entry at /:role/dashboard/reviews. Manual Reviews and Excuses are available in both portals; Face Appeals is admin-only and lives in FaceAppeals.jsx, not ManageUsers. Keep old manual-reviews/excuses URLs and users?tab=appeals redirecting to the matching new section. Preserve organizer My requests links and the existing independent-review and self-review protections. The badge totals pending manual reviews, appeals (admin only), and excuses.

Admin dashboard uses admin-dashboard-bento.css: a lead attendance tile, review queues, one full-card Manage Users link, and up to three live/upcoming event previews. Keep detailed attendance records/bulk actions in Reports. Fetch only the attendance aggregate (limit=1); do not load the full user directory for the launcher. Preserve the current palette, natural mobile stacking, keyboard-accessible links, and missing-data states.

Event management: admin and organizer render ManagedEventCard with shared natural subgrid rows for descriptions, schedule, venue, attendance window, owner, last editor and actions. Preserve all actions and organizer group tools. Event create/update/live-status notifications persist bell notices and defer SMTP; notification failure after a saved edit returns a notificationWarning instead of a false save failure. Attendance report loading feedback stays in a permanently sized header slot, never an inserted block above the table, to avoid pagination jitter.

User-report categories are mutually exclusive: student accounts with organizerAccess:true count as Event Organizers, legacy organizer accounts also count there, and demoted students count as Students. Admins remain Admins. Compute counts from the same safe user snapshot as the ledger, preserving stored student identity and access; do not count promoted students twice. CSV identifies promoted accounts as Student/Organizer. Refresh the Users report on tab entry, data-change events, focus and a slow polling interval.

School terms are manually administered at Manage Users → School terms through /api/academic-periods, stored in Setting under academic-periods. Never infer semester boundaries or auto-promote at a term change. New events require an explicit configured term (defaulting to current); legacy events remain Unassigned until admin assignment. Only admin can change an existing event term. Filters use event metadata, not dates; deleted-event attendance uses term snapshots. Current-term switches must not mutate events, users, attendance or service balances. Keep reviewed year-level advancement/undo separate. See docs/ACADEMIC_YEARS.md.

ID-assisted fallback replaces the organizer live check-in UI under Manual Attendance. Face attendance remains primary. Normal server-timed ID captures apply on physical-ID attestation (not biometric/independent verification); ID photos never prove presence by themselves. Offline device-timed captures, reused images and conflicts require existing independent review. Keep requester/beneficiary self-review blocked. Use idPhotoAttendance service/routes, signed student/event/time/schedule/grant-bound tickets, source=id_photo and method=id_photo. IndexedDB queue encrypts local photos, retains them until a server receipt, and retries stable clientIds idempotently. No OCR, gallery import or cold-start offline SPA is claimed. Evidence is private, authenticated and limited to subject/current submitter/assigned reviewer/admin; no photo URLs in list responses. Expire server ID photos after 30 days; preserve audits and attendance. See docs/ID_ASSISTED_ATTENDANCE.md.

Portal Back navigation uses PortalNavigationTracker and usePortalBack. Dashboard is a navigation root with no Back button. Other portal Back controls may use browser history only when the previous entry was observed for the same account, role, and session; otherwise return to a safe same-portal fallback. Never send portal Back to auth, landing, another account, or another role. Preserve explicit logout confirmation and token clearing. Public Terms navigation remains separate.

Session attendance (November 2026): new create forms use named attendanceSessions with Manila-resolved full timestamps (Time In open, on-time deadline, final entry cutoff, Time Out open/close). Keep the Time In and Time Out actions separate. Per session: complete on-time 0h, complete late 4h, missing exit after close 2h (or 6h if late), absent 8h total. The shared sessionAttendance service serializes writes and finalization, preserves staff hour adjustments and protected excuses, and locks a registered-student eligibility snapshot. New accounts receive no historical absence. ID capture tickets and offline queues bind event/session/action; exit without a confirmed entry remains pending review. Review time never replaces captured time. New sessions cannot be removed/reconfigured after stations, evidence or attendance exist. Do not silently convert old events or rerun old surveys. Run the explicit dry-run/index migration before production multi-session captures; see docs/TIME_IN_OUT_IMPLEMENTATION.md.

Attendance form UX: show a Time In follow-up immediately below the selected event start date/time, then a Time Out follow-up immediately below the selected end date/time, within the same event form. Do not append a session or invent capture windows when event dates change. Optional extra periods are created only through Add another day / activity. Hide day/activity selectors in organizer station/ID capture when there is only one period. Keep the session-based API and penalties unchanged.

Attendance date/time controls: primary Event attendance shares the start/end dates above its time-only follow-ups; do not repeat date pickers below. Date edits must rebase existing primary arrival/departure instants while preserving selected clocks. Extra named days/activities keep their own date controls and must remain explicit. Keep full Manila timestamps in the API and visible midnight rollover. Validate chronological errors locally before sending Create/Save requests. Create/Edit forms derive the on-time deadline from the event start, or Time In opens for additional periods; do not show a separate Late after field. Preserve saved deadlines on unrelated edits.


Departure grace windows: Time Out may open/close after the scheduled event end; only Time In must close by event end. An automatically finished event continues accepting its selected session’s Time Out until the explicit exit deadline. Keep it visible in actionable student/dashboard lists during that period. Manual Closed still stops new captures. Do not shorten departure windows or charge incomplete at event end instead of the exit deadline.

Arrival grace windows: Time In may open before the event start, including while the event is Upcoming. Enforce the January 1, 2026 floor, ordered/non-overlapping attendance windows, and Time In cutoff no later than event end. Do not reject early arrival just because it precedes the event start.

Upcoming event previews across student, organizer and admin show Time In and Time Out directly through EventAttendanceSchedule. Show the final arrival cutoff without a redundant Late after line. Keep same-day ranges compact, include dates for overnight departures, and preserve explicit Time In-only labels for legacy events. Reports/events must include only public session schedule fields so the admin preview can render both windows without exposing eligibility rosters. Never print a session's Time In / Time Out twice on one screen: use SessionAttendanceDetails (window plus recorded instants in one block) and drop the redundant window from the organizer Face station card.

Kiosk identity confirmation requires two clear consecutive descriptors through faceIdentify.identifyBatch; single-frame clients cannot write attendance. Kiosk probes must be built from a pixel tensor (`tf.browser.fromPixels`) exactly like server enrollment - never a raw canvas - so live scans and enrolled descriptors share one preprocessing path. Preserve conservative bounded identification settings, runner-up and near-colliding enrollment rejection, and image-quality guidance. Do not loosen thresholds to fix unknown scans or claim these checks provide liveness/100% accuracy. Keep ambiguous cases on the existing supervised ID fallback; see docs/SECURITY_AND_REGISTRATION.md.

Session absence finalization waits until Time Out closes, not the entry cutoff. Preserve 0/4/2/6/8 outcomes, pending entry reviews, staff hour adjustments, and inclusive exit deadlines. New station tokens cover the chosen session through its Time Out close (legacy tokens retain the 12-hour cap). Only untouched premature automatic absence may be reversed before close, with a ledger log. Scanner routine messages are quiet; error pop-ups have a five-second maximum. Event emails show actual per-session Time In/Time Out timestamps.
Student Community Service uses StudentLedgerRecord vertical cards at all widths (three/two/one columns by available container), retains five records per page and StablePage pagination, and never presents an automatic absence timestamp as a real Time In. ID evidence thumbnails are bounded portrait previews with object-fit contain and optional bounded enlargement; preserve private authenticated fetching and unmodified photo data.

Time In rule correction (Nov 8): new attendance periods use timeInPolicy=window_then_late. The visible Opens/On-time until range determines punctuality, including the final displayed minute; never derive it from the event start. The server normalizes the late-entry cutoff to one millisecond before Time Out opens. Late arrivals remain accepted until that point, even if the event is automatically Finished; manual Closed still stops attendance. Old periods without this policy keep their saved deadlines and historical penalties. Create/Edit show a schedule guide and block invalid/overlapping times locally and on the API. This replaces the earlier instruction deriving punctuality from event start/opening.

Event boundary clarification: the primary period's on-time Time In range must end at or before event start (9:00 AM start permits 7:00–9:00, rejects 9:01). Time Out must open at or after event end (5:00 PM end permits 5:00–6:00, rejects 4:59). Enforce both in the shared form and API. Do not display routine instructions or an always-visible schedule guide; show guidance only after invalid input or invalid submission, including immediately after an invalid boundary selection. Extra day/activity periods retain their own windows.

Additional-day UX: new extra periods persist their own activityStart/activityEnd timestamps and use the same Start → Time In / End → Time Out layout as the main event, with dates only above each follow-up. Apply punctuality/departure bounds against that activity's schedule, not the main event's first day. New-rule clock inputs never silently roll over reversed times into another date; overnight departures require the explicit Closes the next day choice. Old stored periods remain intact and locked schedules cannot be reconfigured.

Multi-day event previews use SessionDayPager: one day/activity at a time with Previous/Next arrows, a Day N of total label and date. Preserve selection by session ID across background refreshes and keep event-list pagination separate. Apply to organizer/admin shared schedules and student attendance cards; single-period and legacy events have no day arrows. Navigation arrows must not submit forms or follow an event link; keep admin preview links separate from these controls.

Per-day schedule editing: sessionEditing resolves protected IDs from attendance/deletion receipts, requests, active stations, active capturePreparedUntil reservations and started rosters. Do not disable all days using the old event-wide sessionScheduleLockedAt flag. Keep used days and the corresponding primary event bounds read-only, with a visible reason; unused additional days stay editable. API checks protected rows by ID and uses event version guards. ID preparation reserves only its selected day for the signed ticket's 48-hour lifetime; station/manual/roster creation use a short scoped reservation to close edit/capture races. Roster locking increments the event version. Never reclassify existing attendance or penalties during schedule edits.
