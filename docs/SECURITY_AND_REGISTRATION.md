# Registration and privacy safeguards

## Student registration

Students enter their name, email, program, year and section, then verify email
ownership before continuing to face enrollment with consent. Academic choices
are BSIT/BSCS/BSEMC, Years 1–4 and Sections A–C. Production registration stops if
email verification is unavailable. Existing unverified accounts cannot bypass
verification by waiting for SMTP to be disabled. Existing verified accounts,
including the Gmail testing accounts, continue working without re-verification.

Official department-masterlist import/matching, registrar integration and Google
sign-in are outside the current implementation scope. No registration-policy
request or extra masterlist loading step is needed. The registered-student list
used for reviewed academic advancement remains available; it is built from
TrackED accounts, not an official registrar feed. Email verification confirms
email ownership and does not establish current enrollment or CCIT membership.

## Attachments and photos

Excuse evidence, including previously stored attachments, opens through
authenticated `/api/files/:filename`. The owner and authorized organizers/admins
can read it; unrelated students cannot. Responses use private/no-store caching.
Public `/uploads` serves only referenced profile pictures. Existing face photos
and appeal evidence remain private. The frontend fetches protected attachments
as temporary blob URLs, with no token in the download URL. Saved DOC/DOCX files
download; PDFs/images open in a new tab. A previously downloaded copy cannot be
revoked by changing the application.

## Sessions and enrollment

Changing/resetting a password increments the account's session version. All old
student/organizer/admin JWTs stop working; users sign in again. Explicitly
unverified accounts cannot use authenticated endpoints. Login attempts are
limited per account and source address. New stations use an HttpOnly, SameSite
browser cookie as well as the station URL, so copying the URL alone cannot run
the scanner in another browser. A password change or organizer demotion revokes
the operator's station access. Previously open stations must be reopened after
this update; new cookie-bound stations retain normal no-click scanning.

An enrolled face can be refreshed immediately when the new capture matches the
same identity. A different identity preserves the old enrollment and requires a
replacement request through existing **Profile → Security → Face Appeals**.
The admin confirms checking the school ID and proof photo. The student then
retakes that approved identity within seven days of approval. Enrollment-version
checks prevent reusing the approval for a different replacement. Proof
descriptors are never returned to clients.

The scanner remains organizer-supervised and does **not** implement certified
presentation-attack detection. Photo/video spoofing risk remains. First face
enrollment should be supervised against the student's school ID; masterlist
membership plus email ownership alone does not prove whose face was captured.
Check-in records identity at an instant, not continuous presence until the event
ends. Independent manual review and audits deter abuse but cannot guarantee
against collusion. Session-based events have separate Time In/Time Out; no
head-turn challenge is used.

### Face identification safeguards (November 2026)

The kiosk requires two consecutive clear frames, not one immediate nearest-face
decision. Both probes must independently identify the same account/enrollment
version and sit within 0.35 descriptor distance of each other. That drift bound
is only a same-session sanity check, not the identity bar: consecutive live
frames of one student legitimately differ by 0.06-0.16 through head movement,
lighting and JPEG re-encoding, so an earlier 0.18 bound rejected real students.
The default/maximum identity distance is 0.40; the runner-up gap is at least 0.10
with a maximum best/second ratio of 0.80. Enrolled references closer than 0.35 are
treated as ambiguous even when a probe favors one of them.
Invalid/permissive identification environment values fall back to these
conservative settings. These are operational safety limits, not calibrated
accuracy percentages or a guarantee against lookalikes.

Kiosk probes and server enrollment must share one preprocessing path. Enrollment
descriptors are computed from a pixel tensor (float face box + `cropAndResize`);
a live probe therefore also feeds `tf.browser.fromPixels` output into the
detector and landmark/recognition nets, never a raw canvas. Mixing the two paths
put the same pixels about 0.06 apart on its own, which is enough to push a
genuine student past the 0.40 threshold. Enrollment JPEGs are captured at 0.97
quality for the same reason. Never widen the identity threshold to compensate for
a preprocessing mismatch.

The camera rejects low-confidence, small, clipped or very dark/bright face
captures and displays corrective guidance. This is not liveness detection.
Ambiguous identities use the existing organizer-supervised ID fallback rather
than automatic attendance. No additional photo or descriptor is stored by these
checks. After deploying both API and frontend, close and reopen existing station
tabs; old single-frame clients fail closed with a reload message.

Enrollment is now gated the same way: `detectFaceDescriptorFromBuffer` accepts an
opt-in `requireQuality` flag (used by `/account/face` and the enrollment-upload
path, not by appeal proof photos). A capture that is too dark, too bright, too
flat, too small, clipped by the frame, or low-confidence is rejected with a
specific code and message, and nothing is stored. The enrollment quality bar is
stricter than the kiosk's live-capture bar because the enrolled reference is
matched against every later probe. Camera previews use a selfie mirror on the
display only: the live video and the captured preview are flipped with
`scale-x-[-1]` so the student sees themselves the way they expect, but the saved
capture is drawn from the raw video frame, so the enrolled reference stays
unmirrored and matches the scanner's unmirrored probe. Mirroring the saved
capture instead would put it about 0.2 away from every existing unmirrored
enrollment. Never widen the identity threshold to compensate for a stored mirror
flip.

Verify on the actual venue devices with the affected students before relying on
automatic matches. Check that each account has the correct enrolled identity;
a face enrolled under the wrong account cannot be reliably repaired by changing
distance limits. Existing incorrect attendance is not automatically reassigned.

## Eligibility and deletion

Graduated and explicitly unverified students are excluded from new automatic
absence penalties, attendance notices, and live check-ins. Historical records
are preserved; documented corrections and delayed review of earlier attendance
remain available. Both admin account-deletion endpoints use one service and
block accounts with pending manual attendance requests before cleanup.
