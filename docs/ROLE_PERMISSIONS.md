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

## Student excuse resubmission

My letters shows the first submission time, latest resubmission time, current status and reviewer note. Students may revise their own on-time pending or rejected missed-event letters until approval, including after the initial seven-day deadline. Resubmission keeps the same letter ID and original createdAt, saves a prior-version snapshot, increments submissionVersion and returns it to Pending. Supporting evidence remains required (one to five retained/new files). Approved letters are final; original late or advance requests do not become eligible through revision.

Student updates and staff reviews compare the submission version and status atomically. A stale reviewer must reload the latest letter. Previous evidence stays in revision history and is cleaned up when the letter/event/account is deleted. Resubmission changes no attendance or service hours; approval remains the staff review action.

My letters displays at most three compact cards per page in a horizontal row. Phones can swipe across the cards, and Previous/Next page controls remain on one row. Long explanations and reviewer notes remain available through Read full letter.

Admin reports put graphs before record lists. Attendance filters live above Recent attendance records and still apply to both charts and the CSV export. Ranking panels and repeated metric/distribution cards are removed; attendance rate is summarized in the status graph. Events and Users each show one distribution chart before their roster.

The student portal keeps the original TrackED layout and navigation, including the structure of its dashboard service ledger. Shared styling scoped to `.portal-refined` applies Campus's lighter Inter headings, neutral card colors, purple accents and quieter borders/shadows to all student sections, including the dashboard service ledger. Light cards are warm off-white with muted lavender details; dark cards use charcoal with muted purple details. Full event details, visible attendance indicators and pagination remain available. Organizer and admin cards share this design, including event/user dialogs and report panels. Administrative monitoring and permissions remain unchanged.

Standalone and nested student cards share the same surface styling, including excuse letters, academic details, identity settings and notification actions. Detailed breakdown uses fixed table columns so text stays aligned between pages. Cards size to their content instead of reserving an empty page area or scrollbar gutter; table and dashboard card scrolling begins only when content exceeds their maximum height.

The organizer mobile navigation has four direct tabs: Home, Events, Manual Attendance and Excuses. All organizer destinations are available without a More sheet; profile and notifications remain in the top bar.

The dashboard's Manual attendance shortcut opens the dedicated page directly. After choosing an event there, student names and emails appear immediately. One name/email search narrows both students without records and existing attendance records; program, year, section and enrollment filters are removed. Existing attendance keeps ten-record pagination, status corrections and service-hour adjustments.

Excuse review uses a responsive grid of up to three letters per row, retaining six letters per page. Status tabs and collapsible period/policy controls share a compact toolbar. Full letter text, timestamps and attachments remain available, and Approve/Reject stay side by side on phones. The organizer dashboard review box fills its available card space. Administrative review confirmation and all approval eligibility rules remain in place.

Admin cards use background contrast, spacing and subtle shadows instead of visible card outlines. The admin workspace has a compact sidebar and header, shorter report charts, and a recent-attendance table. The dashboard keeps attendance rate, pending reviews and upcoming events together; reports place record filters directly above the table. Inputs and useful table separators retain their borders. Each active report tab exposes one Export CSV action above its record table; attendance export still includes the full filtered roster. Admin layout styles load directly with the admin route and remain scoped to that portal.

Admin attendance reports load ten records per page from the API. Charts and totals cover all matching records; CSV export covers the full filtered roster. Changing a record filter returns to page one. Dashboard and report tables use fixed columns to keep text aligned between pages. Academic group descriptions wrap so the full student section stays visible.

All three portals share an optional reference-based Soft UI trial through `.portal-neumorphic`, retaining the compact sidebar/top bar, purple accents and lighter headings. Light mode uses TrackED’s warm off-white and lavender details; dark mode uses its charcoal and muted purple colors. Cards have 18px corners, bright beveled highlights and pronounced lower-left contact/drop shadows matching the latest reference. Inner boxes, secondary buttons and form fields are raised with the same treatment; the earlier deep recessed shading remains removed. Clickable review boxes and secondary buttons have raised and gently pressed states, with visible keyboard focus. Forms keep visible boundaries and attendance statuses retain their semantic colors. Reduced-motion preferences, the student ledger hierarchy, three mobile service-summary boxes, organizer attendance controls and four-tab mobile navigation remain in place. Removing only `portal-neumorphic` from the three portal shells restores the borderless design from before neumorphism; baseline styles remain in the existing refinement/workspace files. A baseline snapshot and rollback notes are saved in the task workspace under `work/design-backups/before-neumorphism/`.

Authentication keeps its original responsive layout. At desktop widths (1024px and above), sign-in retains the left photo/branding panel and the right grid background with a neumorphic form. Below that breakpoint, all auth steps use the original TrackED photo backdrop, translucent fields and no outer card. Registration, password-reset, email verification and face-enrollment consent follow the same desktop/mobile styling rule. Resizing updates only presentation and retains entered field values. Auth handlers, password policy, email verification and face-capture behavior are unchanged. The pre-style AuthPage.jsx snapshot is stored alongside the pre-neumorphism design backup.

Community service summary cards place their heading, value and explanatory hint inside one raised inner box, with reduced outer padding. The three summaries remain equal and side by side on phones; longer hints retain their existing screen-reader-only mobile treatment to keep the row compact.


The organizer dashboard keeps live/upcoming events (three per page) on the left, with Face station and Manual attendance side by side on the right and Excuse letters filling the space below them. The separate station-controls dashboard card is removed. The Face station action still opens the attendance kiosk; station APIs retain their existing open/close permissions and monitoring capabilities.

On phones, all three portals use the topbar hamburger to open a full navigation drawer. The fixed bottom tab bar is no longer mounted, leaving dashboard cards unobstructed. The drawer closes after navigation, on Escape, or on switching to desktop width, and returns focus to its trigger.


Local reliability/scroll cleanup: the Vite proxy defaults to IPv4 loopback to match the backend listener, and backend connection failures return a JSON 503 with a retry hint instead of an empty proxy 500. Portal shells use the dynamic viewport height and a single main scroll area, with safe-area padding at the bottom. Paginated student dashboard cards no longer force a second vertical scrollbar; admin user tables only become internally scrollable when they exceed their maximum height. Unused MobileTabBar.jsx, navMobile.js and the unmounted CheckInStation.jsx component were removed. The attendance kiosk opener and backend station APIs remain available.
