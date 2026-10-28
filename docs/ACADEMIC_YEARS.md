# Student academic years and semesters

## Current local preview

`backend/config/academicCalendar.json` contains a sample calendar with `confirmed: false`:
- School year starts August 1.
- First semester: August 1–December 31.
- Second semester: January 1–May 31 of the following calendar year.
- June/July are between semesters in this sample, not silently assigned to either semester.

Students can see their current year level, section and program under Profile > Academic standing, preview their next school year, and filter Community Service attendance records by school year and semester. Previewing does not write to accounts. Record filtering never resets the all-time service balance. Sections remain unchanged during year promotion.

## Automatic progression

The rollover implementation is inactive until official dates are entered and `confirmed` is set to true, then the backend is restarted. Confirm dates before doing this; these sample dates are not school policy.

On the first official synchronization, an existing account without an academic-year anchor keeps its current year level and receives the current school year as its baseline. The system does not guess how many past promotions that account had. Accounts then advance once per subsequent school-year boundary, not per semester or January 1. First through third years advance to the next level; fourth year becomes Graduated with yearLevel retained at 4 for historical compatibility. Graduation is a status update; accounts and outstanding hours are retained.

Updates run at startup, hourly, and when the student logs in or opens account/academic standing. An atomic comparison prevents concurrent requests from promoting twice. Previous standing is saved to academicHistory before advancing. Graduated accounts are not repeatedly promoted. An administrator's existing group-edit controls remain available for correcting a section; no random reassignment is performed.

## Excuse letters

New requests are for recorded absences only, must include 1–5 supporting documents, and must be submitted from the event's scheduled end through seven days after that instant, inclusive. The API and event-picker eligibility use the same rule. Multi-day events use their end date. If no end time was configured, the existing event lifecycle uses the end of that event's final Manila calendar day. Expired absences remain in attendance history but are not offered for new excuses. Old pending/approved requests are not deleted by the deadline change.

## Checks

Run backend `npm test` and frontend `npm run lint`, `npm test`, and `npm run build`. Local browser checks cover academic previews, filters, unchanged balances, pagination, and eligible excuse choices. Test fixtures do not establish that the sample academic calendar matches the school's official dates.
