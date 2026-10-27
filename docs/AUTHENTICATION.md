# Authentication after PIN cleanup

All roles sign in using email and password. Students complete email verification when email delivery is enabled, then enroll their face for attendance. Existing students without attendance enrollment are directed to enrollment on login. Older recovery photos can be replaced during attendance enrollment.

Forgot Password is the only account-recovery flow on the sign-in page. It sends a one-time email code and lets the user choose a new password. This code is temporary; it is not a stored security PIN. Face matching is for attendance, not password recovery.

Removed: PIN assignment/rotation, new-device PIN verification, trusted devices, face-based PIN recovery, staff PIN-reset requests and controls. The User schema no longer defines PIN or trusted-device fields. Explicit field exclusions and stale-index repair remain to protect compatibility with older databases; no production records were deleted.

Face enrollment and self-service replacement are available in Profile > Security, without a separate password prompt or required administrator reset. Attendance verification appeals remain available. Student onboarding has no skip-enrollment action. If enrollment is not possible, the student can sign out and contact an administrator.

Validation: `npm test` in backend; `npm run lint` and `npm run build` in frontend. Route tests use mocked persistence; real email delivery and camera acceptance require live testing.
