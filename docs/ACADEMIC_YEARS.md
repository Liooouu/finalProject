# School years and semesters

An administrator configures terms under **Manage Users → School terms**.

1. Add a starting year (2026 creates S.Y. 2026–2027).
2. Choose that school year and 1st Semester or 2nd Semester.
3. Confirm **Set current term** when the department is ready.

Dates are not assumed or required. Adding a school year alone does not activate it.
The initial deployment has no current term until an admin configures one. Event
creation defaults to the configured current term; creators can choose another
configured term for a future event. Configure a term before creating new events.

Existing events stay Unassigned; an admin can assign them through Edit event.
Organizers can edit other event details but cannot move an existing event to a
different term. Active/past lifecycle states still follow the event schedule.

School-year/semester filters use saved event assignments, never date guesses.
All S.Y. includes legacy records; Unassigned isolates them. Attendance and Events
reports and their CSV exports use the same period filter. Deleted event attendance
retains its assignment snapshot. Existing events remain the authoritative assignment.

Changing the current term does not update student year levels, graduate students,
reassign old events, or reset attendance/service balances. All-time service balances
remain all-time even when the displayed records are filtered. Reviewed advancement
and undo stay separate under Year levels (see ACADEMIC_UPDATES.md).

Terms are stored in the existing Setting collection (academic-periods key). Only
admins can add/activate terms; authenticated users can read their safe public fields.
Version checks reject stale concurrent activation attempts. No SMTP configuration
is returned by the academic-periods API.

The seven-day post-event excuse submission rule is unchanged.
