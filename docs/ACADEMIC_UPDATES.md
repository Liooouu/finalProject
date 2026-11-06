# Academic year advancement

Manage Users has a **Year levels** tab beside Users and School terms.
Only an administrator in the admin portal can use the corresponding API.

1. Open the tab. Search a student name/email or use the clearly labeled Program,
   Year level and Section filters. Programs are BSIT, BSCS and BSEMC; years are
   1–4. Search works across eligible registered students before choosing a class.
2. Choose all three class filters to enable an update. Only that class loads
   for review, five students per page. No Load button is needed. If there is
   only one eligible class, its filters fill automatically.
3. No students are checked initially. **Check all** selects the entire class,
   across all pages and search results. Uncheck students who should not advance.
   Checked Years 1–3 advance; checked fourth-year students graduate only after
   explicit review and confirmation. Unchecked students keep their complete
   academic standing, including their school-year assignment, unchanged.
4. Review the selected names and counts, then confirm. Refresh preserves the
   selection for students still in the same preview. A new class starts unchecked.
5. Use **Clear search & filters** to return to the full student list. Click the
   eye icon in Recent bulk updates to inspect saved results in a popup.

Search and pagination do not limit the batch. Every eligible student in the
saved preview for the selected class is included once, including students with organizer access.
The server saves the class scope with the batch and its history. It rejects a
new API preview without a valid class; filtering is not only a screen display.
Earlier saved batches remain reviewable/undoable with their original scope.
Program and section stay unchanged. Unchecked students retain their source
school year and year level. The target is one school year after
the source; a source later than the current configured school year is refused.
Manual school terms do not establish
official enrollment or graduation.

The preview excludes already processed, graduated, incomplete, and other-year
student records. Accounts without an academic-year anchor are treated as
belonging to the explicitly reviewed source year. Confirm academic decisions with the department; this account list is not an
official registrar integration. A new student or academic edit made after the preview is not
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

## Saved results

After confirmation, a compact summary remains on the page. The eye icon opens
**Saved update results** in a dialog with each student's previous year,
year after the update and result. It uses the saved batch, so students remain
visible after promotion, graduation, later profile edits or account removal.
The list has five students per page and a name/email search for larger batches.
The summary distinguishes advanced, retained, graduated, skipped and failed.
Skipped/failed students never show a planned year as an applied change.

Results stay in Recent bulk updates after refreshing. The eye icon opens an
earlier batch without adding another full card to the main screen. An open
result dialog remains selected after a refresh; the
selected batch is stored in the page URL without storing student data there.
Closing the dialog returns to the student filters. A fully undone update is
removed from Recent bulk updates. Its internal batch/transition audit is kept;
incomplete undos stay visible for review and retry.
Reading or searching results never advances students or changes their records.

## Undo an accidental update

Use **Undo this update** on the result, or find it in **Recent bulk updates**
in the same tab. The list remains available after a refresh and shows five active/reviewable
batches per page. Fully undone updates disappear from this list. Any administrator can undo a completed or partly saved
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

If the student's year level was already set back but the school-year assignment
or transition was not restored, Undo first reviews that state. **Finish undo**
shows the affected names/emails and the school-year rollback before confirming.
Only students whose program, section and previous academic standing still match
this batch qualify. Newer transitions and different academic edits stay protected.
This recovery uses current-record comparisons and atomic writes; no force-undo
option bypasses those checks. A fresh reviewed batch can advance the restored
students again; its results appear as a new history entry.

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
