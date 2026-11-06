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
against collusion. No checkout or head-turn step was added.

## Eligibility and deletion

Graduated and explicitly unverified students are excluded from new automatic
absence penalties, attendance notices, and live check-ins. Historical records
are preserved; documented corrections and delayed review of earlier attendance
remain available. Both admin account-deletion endpoints use one service and
block accounts with pending manual attendance requests before cleanup.
