# ID-assisted attendance fallback

Face verification remains primary. Event-assigned organizers open Manual Attendance, choose an
event, select a registered student by name/email, and capture a JPEG of the physical
school ID with the rear camera. They must compare the person, ID and account in
person, then attest and submit. There is no gallery upload or OCR in this version.
ID capture is not biometric verification, proof of ID authenticity, or proof against
organizer collusion. OCR is deferred until actual IDs/low-end cameras are evaluated.

## Time and decisions

A successful online capture-time request returns a signed, student-bound server
timestamp and attendance-window snapshot. Retries retain this timestamp; upload or
review time does not decide lateness. Every new ID capture stays pending until an
administrator approves or rejects it. Approved records retain the submitter and
administrator in the audit, with source=id_photo and Attendance.method=id_photo.

Prepare the event online once and keep the page open before a connectivity outage.
The roster is in memory only. During an outage, capture time is estimated from that
server anchor and the browser monotonic timer. This device claim is not tamper-proof:
it enters the administrator review queue after sync. An administrator can confirm
the original claimed time, even after an event ends. Requester and beneficiary cannot approve their own exception. Changed event
schedules, reused exact ID images and conflicting records also remain pending.
Human corrections, approved excuses and face attendance are not silently overwritten.
Closed events use documented corrections; this is not a backdating bypass.

The signed capture/prepare ticket is valid for 48 hours and tied to the issuing account,
session version and organizer-grant version. Expired captures remain on device for
attention rather than being falsely marked recorded. Revoking the event assignment or organizer grant blocks new uploads. An existing upload receipt can still be recovered by a current organizer.
A failed upload may need a documented correction; do not discard its only copy until
the existing record has been checked.

## Offline storage and retry

Pending photos are account-scoped in IndexedDB, encrypted with a non-extractable
AES-GCM key stored by that browser. This does not protect against compromised same-
origin JavaScript or a compromised device. At most 50 photos can wait on a device.
The queue paginates five captures per page. Photos survive a page close, but do not
clear browser/site data before syncing. Sign in with the same organizer on the same
browser/device to retry. The SPA must already be loaded for offline capture; a fresh
cold start/reload without internet is not supported. Keep the capture page open during
an outage. No service worker caches API data, rosters, or ID photos.

Sync runs on reconnection and every 30 seconds while the capture component is open.
The Offline sync panel is visible even with no queued photos or no event selected.
Sync now is available when the browser is online and photos are waiting. A stable clientId and a unique database
index make retries idempotent, including response-loss retries. Only a server receipt
removes encrypted local photo bytes. 400/403/409/expired captures stay for attention;
Discard has explicit confirmation. Pending sync never means attendance recorded.

## Evidence and retention

The server validates/decodes JPEG (max 3 MB, max 6 megapixels), re-encodes to strip
metadata and stores it privately in GridFS. No public upload URL is exposed. The
student concerned, current submitting organizer, organizer currently assigned to that event, or
admin can explicitly open evidence through the authenticated no-store reader. Other
organizers cannot view it. Normal directories/reports never render ID photos.

Server ID photos expire after 30 days; a startup/hourly cleanup deletes their bytes
in batches and preserves the attendance/request audit. The reader refuses expired
photos even before cleanup. Account deletion removes referenced ID evidence. This
30-day application policy should be confirmed by the department before live rollout.

## Verification

Backend node tests cover timestamp classification, offline boundaries and image
validation. Isolated Mongo/API and real Chromium checks cover role restrictions,
self-review protection, online submission, later offline review, duplicate retries,
reused images, private readers, retention, camera capture, IndexedDB encryption,
network interruption/reconnection and 390/1440px layouts. Real school ID readability,
physical low-end phones and school connectivity still require field testing.
