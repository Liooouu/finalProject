# Uploaded face enrollment

Students choose Use camera or Upload photo after face consent, during sign-in enrollment or in Profile > Security. Gallery upload is available only for enrollment; attendance and physical-ID capture remain live-camera flows.

Uploads accept JPG/PNG up to 4 MB. Server detection must find exactly one face. The private image and server-derived descriptor are stored in a pending FaceAppeal (`enrollmentUpload: true`), bound to consent and the current enrollment version. Submission does not change the enrolled face or scanner index. Existing enrollments remain valid.

Admins open Reviews > Face Appeals. Six requests appear per page. Select all on this page selects only pending enrollment uploads. Individual and bulk approvals require an identity-check confirmation; rejection requires a reason of at least five characters. Photos and face detection do not establish identity; admins must independently verify the student.

Approval atomically checks the saved enrollment version, activates the photo and descriptor, records consent, increments the version and updates the scanner index. Old requests cannot overwrite newer enrollments. A private user-side receipt makes retries safe after interrupted appeal writes. Review claims prevent concurrent decisions; interrupted claims can be retried after one minute. Bulk operations report per-request failures.

Students use Check status after submitting. Approval completes sign-in enrollment; rejection shows the admin's reason and permits another upload. Existing lock-support and seven-day replacement appeals retain their behavior.

Routes: POST /api/account/face-enrollment-upload, owner-only GET /api/account/face-enrollment-requests (also available during onboarding on /auth), existing owner-only GET /api/student/security/face-appeals, and admin-only POST /api/admin/security/face-appeals/:id/review. Descriptors are excluded from responses. Photos use authenticated private retrieval. Evidence is retained with existing face-appeal audits; no new automatic retention policy is introduced.

The upload chooser fills the available width before selection. Change photo replaces a selected image; Cancel upload clears its preview, file input and consent without leaving the upload option. The same file can then be chosen again. Failed status reads offer Try again and block upload until status is checked; camera enrollment remains available. Enrollment uses a compact, uncropped camera preview.

Admins can delete an appeal through DELETE /api/admin/security/face-appeals/:id after confirmation. Deletion removes it from all request lists, frees pending submissions and withdraws unused replacement grants. A minimal deletion/review audit is retained with status=deleted; inactive evidence is removed, while active enrollment photos are preserved. Review claims and unfinished enrollment writes block conflicting deletion. Attendance and enrolled identity are not modified. Pagination clamps to a valid page after deletion.
