# Role responsibilities

- Students enroll their face and view their attendance, service ledger, events, and excuse letters.
- Event organizers operate face stations and manually record or correct attendance for their own events and events created by an administrator.
- Administrators monitor all events, records, users, and reports. They can create and edit any event, correct its schedule or venue, manage accounts, review excuses/identity appeals, and correct service hours on existing records through user management.
- Administrators cannot open face stations, manually add attendance, change attendance status, or create attendance records through the event attendance APIs. Attendance monitoring is read-only. Administrators retain permission to close an unsafe station as an oversight intervention.

An administrator-created event is available to event organizers for attendance operations; creating the event does not grant its administrator attendance-entry permission.

## Student promotion

Administrators use **Promote Student** to grant organizer access to an existing student account. Promotion sets `organizerAccess`, `organizerPromotedAt`, and `organizerPromotedBy`; it does not change the stored student role, account ID, password, academic record, enrolled face, attendance, or service ledger.

Promoted students sign in with their existing credentials. The account menu offers **Switch to organizer portal** and **Switch to student portal**. Each switch obtains a server-signed token for that portal. The API checks the stored grant on every request and never trusts a client-supplied role without checking it. The student and organizer portal contexts have separate permissions; organizer access never grants administrator permissions.

Student officers remain included in student directories, face identification, academic-year progression, absence processing, and student reports. User management labels them **Student/Organizer** and includes them in organizer access listings. Account-distribution charts count each account once under its stored identity.

`POST /api/admin/create-organizer` is retired (410). Existing organizer accounts continue to work. The former create-organizer page redirects to promotion. No real accounts are promoted by deploying this change; an administrator must select and confirm each promotion.

## Demotion and academic corrections

In **Manage Users > View**, administrators can edit a student's current program, year level (1–4) and section (A–C), including students with organizer access. These corrections retain attendance, ledger entries, face enrollment and academic history.

**Remove organizer access** requires confirmation and calls `POST /api/admin/users/:id/demote-organizer`. It removes the additional grant while preserving the student identity and records. The API closes the student's face stations and revokes organizer sessions. A grant version is checked on organizer JWTs and public face stations, so re-promotion cannot revive an old token or station. Legacy accounts whose primary role is organizer are not student demotion candidates.

## Overall service balance

Manage Users > View shows one overall student service balance, with Set total and Clear balance controls, rather than editing each event row. Attendance history is read-only and paginated at five records per page. Event penalty logs and remaining hours stay visible after a balance correction.

`PATCH /api/admin/users/:id/community-service` accepts `hours` (the desired total) and `expectedTotal` (the balance displayed before confirmation). The server rejects a stale balance. Reductions apply oldest outstanding event hours first; increases are logged against an existing outstanding record, or the latest attendance record. No attendance records or statuses are created or changed. The existing attendance ledger remains the source for student balances and reports.

## Shared event editing and past events

Organizers can edit any event's information, status and automation, including another organizer's past events. This does not transfer ownership. Attendance operations still use the original owner/admin-created-event policy, and deletion remains limited to the owner or administrator.

Every explicit edit stores server-generated `lastEditedBy`, `lastEditedByName` and `lastEditedAt`. Lists and details show the latest editor and date/time. Automated lifecycle updates do not overwrite that human editor stamp. Existing events have no edit stamp until a staff member edits them.

Manage Events defaults to All events and exposes All events / Active events / Past events outside the optional filters. Past events includes Finished and Closed across all school years unless a school-year/semester filter is selected.

User management groups each account once: promoted students appear in the Admin & Event Organizers list and organizer count, while the Students list/count shows student-only accounts. Admins + Organizers + Students equals Total accounts. Promoted students retain both portals and all student records. Demotion moves the account back to the Students list.

## One personal profile across portals

A promoted student sees the same Profile, Academic record and Security sections in either portal. Name/email/photo edits use the same account, and face enrollment/replacement and face appeals remain attached to that student ID. The profile identifies the combined access as Student/Organizer.

The organizer-scoped token may access its student's own academic standing and face appeals, and replace its own face enrollment. `hasStudentProfile` checks the stored identity provided by authentication; a legacy organizer or administrator is not a student profile. Other student portal endpoints retain their existing role restrictions. Academic progression loads the stored student document without changing the organizer session's role.
