# Session Time In / Time Out

Implemented locally on November 8, 2026. No commit, push, or deployment was performed.

## Behavior

New event forms include named attendance sessions, one per required day/activity. Each session has full Philippine-time dates and times for Time In opening, on-time deadline, last Time In, Time Out opening and Time Out closing. Up to 30 sessions are validated, including overnight dates, ordering, event bounds and overlapping capture windows.

| Result per required session | Automatic penalty |
| --- | ---: |
| On-time Time In and valid Time Out | 0 hours |
| Late Time In and valid Time Out | 4 hours |
| On-time Time In, missing Time Out after closing | 2 hours |
| Late Time In, missing Time Out after closing | 6 hours |
| No valid Time In after cutoff | 8 hours total |

Arrival and completion are separate. Before the exit deadline, an attendee is awaiting Time Out, not incomplete. Time In may open before the event starts, including while its status is Upcoming. The departure window may extend after the event ends (for example, event ends 5 PM and Time Out runs 5:01–6 PM). Automatically finished events stay visible/actionable for Time Out until that deadline; manually Closed events reject new captures. Time Out alone cannot establish attendance. Automatic reconciliation runs with the existing one-minute lifecycle job. Already finalized rows are not repeatedly written.

Existing events with no attendanceSessions retain Time In-only behavior. Existing attendance and service adjustments are not converted or recalculated. A registered-student snapshot, locked when the session opens, prevents new accounts from receiving historical absence charges. This is the registered account roster, not an official registrar masterlist.

## Screens and workflow

- Admin and organizer Create/Edit Event place the Time In follow-up under the start date/time and the Time Out follow-up under the end date/time. Primary attendance shares those dates; there are no repeated date pickers. Extra named periods retain separate dates. Time controls use the shared TrackED picker, and midnight rollover remains visible. Local validation explains an invalid ordering before a Create/Save request is sent. Late after may equal the opening time (no grace period); an earlier deadline is invalid. Event date changes do not generate a session or attendance times. Additional days/activities are optional and appear only after an explicit Add another day / activity action. Single-period events hide the redundant day/activity selector in station and ID capture. Preparing an ID desk or opening a station freezes session times before signed offline tickets can be issued; descriptive event details remain editable. Version checks reject racing edits.
- An organizer chooses the event and session before opening its face station. The server switches that station between Time In and Time Out using its selected session, never another session of the event. Existing organizer permissions, station-browser binding and supervised face-matching thresholds remain in force.
- Live ID-photo capture chooses a session and automatically uses its current Time In/Time Out window. No gallery upload was added to attendance. Queued captures are encrypted and keyed by event/session/student/action. Signed tickets bind the same scope. An offline exit without an approved entry remains pending; reviewers can approve the entry first and retry the exit. Batch review processes entries before exits.
- Admins and assigned reviewers still cannot approve their own submission or attendance. Review uses the saved capture time, even on the following day. A missing exit may be independently confirmed without changing the original face entry; existing face actions and approved excuses are protected.
- Student dashboard/events/details, recent activity and ledger show session name, Time In, Time Out, completion and the penalty reason in one block per session. The scheduled window and the recorded instants share a single Time In / Time Out label; the window is not repeated on the same screen. Admin reports show completion totals separately from the Time In rate; records can be filtered by session/completion and CSV exports include both times, arrival, completion and service hours. Event attendee counts count distinct students across sessions.
- A new excuse letter covers one selected absent session; approval clears only that record. Legacy event excuses keep their previous scope. Submission deadlines use the selected session's end. Concurrent attendance updates cannot be overwritten by excuse approval.
- Automatic penalty contributions are tracked separately from the remaining service balance, so later scans/reviews preserve staff adjustments. Manual-review and face evidence are retained in their existing private audit paths. Internal eligibility roster IDs are excluded from API JSON.

## Database migration

`backend/scripts/migrate-attendance-sessions.js` defaults to read-only preview and requires an explicit `TRACKED_MIGRATION_URI`. It refuses duplicate keys rather than deleting or merging records. Apply during a maintenance window after backup:

```powershell
$env:TRACKED_MIGRATION_URI = '<intended MongoDB URI>'
node scripts/migrate-attendance-sessions.js
node scripts/migrate-attendance-sessions.js --apply
```

It creates the session and legacy uniqueness guards before removing the old event/student-only guard, replaces the pending-request guard with an event/student/session/action guard, and tags legacy requests without an action as Time In. Equivalent indexes created by OpenCode are reused. No events, attendance rows, balances or survey data are rewritten.

The localhost `127.0.0.1:27017/TrackED` migration was applied after a metadata backup under `%LOCALAPPDATA%/TrackED/migration-backups`. Its nine attendance records were preserved. No production database was accessed or migrated. Before production rollout, back up that database and perform the same explicit preview/apply migration.

## Verification

Final results: 330 backend regression tests and 8 isolated MongoDB integration tests passed. Frontend auth/session render checks, production build and ESLint passed. The existing large face-recognition bundle warning remains; recognition models were not changed.

- Backend regression suite: `npm test` in backend.
- Real MongoDB integration suite: set `TRACKED_TEST_MONGO_URI=mongodb://127.0.0.1:27029/tracked_session_test`, then run `node --test tests/session-attendance.integration.test.cjs`. It refuses any other target. Tests include concurrent scans, all penalty outcomes, delayed/out-of-order review, retained adjustments, protected excuses, separate legacy/session rows, schedule preparation races, and idempotent index migration.
- Frontend: `npm test`, `node scripts/check-session-render.mjs`, `npm run build`, and `npm run lint`.

Real device camera quality, lighting and the follow-up user evaluation still require human testing. Automated tests do not replace the planned follow-up evaluation or alter the original 30 survey responses. Production rollout and paper result claims must reflect that distinction.
