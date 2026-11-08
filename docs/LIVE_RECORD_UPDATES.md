# Live record updates

Portal records refresh without a full browser reload after attendance, reviews,
events, accounts and other saved changes. Student dashboards, event lists and
service ledgers use the existing `useAutoRefresh` subscription. Admin report tabs
and the account directory also subscribe. Existing filters and page selections
are retained; account edits are not refreshed over an open details form.

`GET /api/record-updates` requires the current portal's bearer token. It is an
SSE stream consumed through `fetch`, keeping tokens out of URLs. The stream sends
only `ready` and `changed`, with no names, IDs, photos or records. Screens fetch
their data through the same authorized endpoints as before. Notifications and
session attendance publish after persistence, including background finalization.
Successful API writes also publish; failed/repeated camera matches stay quiet.

One connection is shared by subscriptions within a tab. Hidden/offline tabs close
it, account/role changes replace it, and reconnects refresh missed records. The
server closes connections after five minutes or token expiration, whichever is
earlier, requiring authentication again. Heartbeats keep proxies from timing out;
`X-Accel-Buffering: no` prevents nginx from holding update messages.

The hub is process-local. The existing 10–30 second polling fallback remains for
outages, unsupported streaming proxies, or writes handled by another API replica.
This does not reload newly deployed website versions or migrate database data.

Checks:

- `cd backend` then `npm test`
- `cd frontend` then `node scripts/check-record-updates.mjs`
- Frontend lint, session render checks and production build

For a live check, leave the student's dashboard/ledger open on one device and
record Time In/Time Out on the organizer station on another. The open record
should update without pressing Refresh. Repeat with an approved manual request.
If the stream is blocked, records still update on the fallback interval.
