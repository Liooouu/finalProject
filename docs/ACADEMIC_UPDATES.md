# Academic year advancement

Manage Users has an **Advance year levels** tab beside Users and Face appeals.
Only an administrator in the admin portal can use the corresponding API.

1. Open the tab. The current school year and masterlist load automatically.
   Use **Change school year** only when reviewing another available year.
2. Search by student name or email. Check **Keep current year level** for
   first- through third-year students who should not advance.
3. Fourth-year students retain Year 4 by default. Check **Mark graduated** only
   for students whose completion has been confirmed by the department.
4. Review the counts and named exceptions, then confirm the batch.

Search and pagination do not limit the batch. Every eligible student in the
saved preview is included once, including students with organizer access.
Program and section stay unchanged. An exception still moves to the target
school year, but retains their year level. The target is one school year after
the source; a source later than the current configured school year is refused.
Dates in the unconfirmed calendar are still provisional and do not establish
official enrollment or graduation.

The preview excludes already processed, graduated, incomplete, and other-year
student records. Accounts without an academic-year anchor are treated as
belonging to the explicitly reviewed source year. Check the department's official
masterlist first. A new student or academic edit made after the preview is not
silently included or overwritten. Draft previews expire after an hour.
Refreshing preserves exception selections for students still in the new preview.
An empty roster shows that no students need updating, with no confirm action.

Year levels no longer advance during login, account/profile reads, server startup,
or a scheduled timer. Calendar and semester filters remain date-based.

Each user update atomically saves the previous academic standing in
`academicHistory` and a before/after audit in `academicTransitions`, including
the administrator, timestamp, action, and batch ID. Attendance and service-ledger
documents are not rewritten. A target-school-year guard prevents duplicate
advancement, even across separate concurrent batches.

The `AcademicAdvancement` collection holds reviewed rosters, fixed selections,
and results. Confirming the same batch again returns its saved result. If a batch
is partly saved, **Retry same batch** resumes the original selections without
advancing completed students again. Skipped records are named for review;
failed records can be retried. Do not treat a partial result as a completed batch.

## Undo an accidental update

Use **Undo this update** on the result, or find it in **Recent bulk updates**
in the same tab. The saved list remains available after a refresh and shows
five batches per page. Any administrator can undo a completed or partly saved
batch after confirming which update to restore. Drafts and running updates
cannot be undone.

Undo restores the saved school year, year level, and enrollment/graduation
status for students actually updated by that batch. It leaves attendance,
service hours, organizer access, program, and section alone. A newer active
academic batch must be undone first. Changed academic details are skipped and
listed for manual review; an edit racing with the undo is also protected.
**Retry undo** resumes interrupted or partial restores without changing a
student twice. An undone batch cannot be confirmed again; a fresh, reviewed
preview is required to advance restored students.

Transitions are retained permanently with `revertedAt` and `revertedBy` for an
audit. New academic-history snapshots are tagged with their batch and removed
only when that batch is undone. Older untagged history is preserved. The batch
also keeps the undo administrator, time, per-student outcomes, and any conflicts.

## Event dates

Both portal creation forms and the shared event editor enforce a minimum date of
January 1, 2026. The API also validates real calendar dates, clock values, and a
positive event duration for create/update requests. Existing historical records
are not deleted or silently redated. Editing an old pre-2026 event requires
correcting its schedule to a valid date before saving.
