# TrackED system scope

TrackED supports attendance monitoring and reporting for CCIT departmental
events managed through FACTS. It serves BSIT, BSCS and BSEMC students through
student, organizer and administrator browser interfaces. This implementation
scope follows the objectives in the local TrackED paper. It does not replace
institutional enrollment, academic or disciplinary decisions.

## Features retained and their objectives

| Paper objectives | Functions retained |
| --- | --- |
| 1.1 | Account management and academic corrections; reviewed bulk year advancement per class, exceptions and undo. The account list comes from TrackED, not the registrar. |
| 1.2 | Grant/remove organizer access while preserving the student's original account and records. |
| 1.3 | Admin event creation/correction, identity appeals, excuse decisions and authorized service-balance corrections. |
| 1.4 | Attendance summaries, charts, search, pagination and filtered CSV reports. |
| 2.1 | Event creation, schedules, collaborative event editing, current/upcoming/past events and editor attribution. |
| 2.2 | Organizer-operated face stations and manual attendance/correction requests with independent review. Decisions use the recorded attendance time, not approval time. |
| 2.3 | Review other students' excuses, including other student organizers; own submissions remain viewable but cannot be self-approved/rejected. |
| 2.4 | Attendance inspection and traceable service-hour records. Current attendance corrections use independent review; separate balance interventions are administrative. |
| 3.1 | Student signup, email verification, sign-in, password recovery, consent-based face enrollment and controlled replacement. |
| 3.2 | Event details, attendance results, notifications and the personal community service ledger. |
| 3.3 | Eligible post-event excuse submission/resubmission, required attachments, submission timestamps and decisions. |
| 3.4 | One student identity with explicitly granted organizer access and portal switching. |
| 4 | Functional/access checks, supervised face trials and questionnaire evaluation. Tests and trial tools support this objective. |

Authentication, session revocation, private evidence files, authorization,
independent review and audit records support these workflows. They remain even
where the objectives do not name an individual security mechanism. SMTP email
delivery, themes, responsive layouts and pagination also support normal use.

## Removed from the current implementation

- Official department registration-masterlist CSV import, preview, search and
  removal screens, plus the extra Manage Users tab.
- Registration restrictions, identity locks and name/academic autofill tied to
  that imported list, including the requirement flag and public policy endpoint.
- Signup's policy-loading/retry step and masterlist-only profile restrictions.
- Models, services, routes and tests specific to that removed feature.

The original signup remains: students enter academic details and verify their
email. No live accounts or attendance records were deleted during this cleanup.
Google sign-in was discussed but was not implemented.

## Outside the system's scope

- Verifying official CCIT membership or current enrollment against a registrar,
  school information system or official department masterlist.
- Grading, scholarship eligibility decisions, financial transactions, payments
  or broader school administration.
- GPS/geofencing or other location-based proof of attendance.
- A native Android/iOS application or guaranteed offline attendance operation.
- Tracking continuous presence, checkout or proving that a student stayed for
  the full event. A successful face check-in records attendance at an instant.
- Independently proving completion of community service work. The ledger
  records attendance-related obligations and authorized adjustments.
- Guaranteed prevention of proxy attendance, photo/video spoofing or staff
  collusion. The scanner is organizer-supervised; it is not certified liveness
  detection. Manual requests require independent decisions.
- Automatic academic promotion based on official grades or enrollment outcomes.
  Bulk advancement requires an admin to review choices, exceptions and graduation.
- Weather, achievements, unrelated calendars or leaderboards.

## Paper wording to keep synchronized

The document's reference to automatic year progression dependent on a confirmed
institutional calendar should describe administrator-reviewed advancement,
exceptions, confirmed graduation and undo. The existing manual attendance and
organizer service-hour wording should distinguish a request from the independent
approval that applies a correction. These notes identify wording for a later
paper revision; this cleanup did not edit the submitted Word/PDF files.
