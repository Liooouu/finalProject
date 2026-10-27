# TrackED face attendance handoff

The existing OpenCode changes were continued in C:\Users\63945\Desktop\TrackED. The current design uses a supervised organizer-operated face identification station in place of QR attendance. The station searches enrolled students, rather than asking students to scan a code or log in on the station.

## Try it locally

1. Start the configured MongoDB and backend (`cd backend`, `npm run dev`), and start the frontend (`cd frontend`, `npm run dev`). Use localhost for same-device camera access or HTTPS on another device; ordinary HTTP LAN addresses may not allow the camera.
2. As a student, open Profile > Security and enroll a face after accepting the attendance disclosure. Manual attendance remains available if enrollment is declined or recognition fails.
3. To replace an existing face, open Profile > Security > Change enrolled face, agree to the replacement, capture a new photo, and select Use this photo. No separate password confirmation or administrator reset is required. Older recovery photos can be replaced the same way.
4. As an organizer or administrator, open an event with a configured attendance window and select Open station. Allow camera access in the new tab. Keep the station URL on the supervised device.
5. Have one enrolled student face the camera. Confirm their name, attendance status, and the saved attendance list. A second scan should show Already checked in. Test unknown faces and two people in the frame; neither should be selected arbitrarily.
6. Close the station from the organizer's event page. Confirm it stops accepting attendance. Test both on-time and late windows using a dedicated test event.

## Completed integration fixes

- Security settings now collect and submit enrollment consent, and display attendance enrollment state.
- Enabled self-service face replacement and retained administrator reset as an optional support tool.
- Enrollment and kiosk detection reject multiple visible faces.
- Face matching excludes enrollments without attendance consent. The write path checks the enrollment version so a cached old face cannot mark a newly enrolled account.
- Enrollment cache updates no longer postpone the scheduled full cache refresh indefinitely.
- Added visible scanner-start failure recovery and input validation for station management IDs.
- Added face attendance regression checks and resolved frontend lint errors.

## Verification

- Frontend ESLint: passed.
- Frontend production build: passed. Vite reports a large face-model JavaScript chunk; this is a build warning.
- Backend regression checks: 18 passed. Run `npm test` in backend. These exercise matching, attendance rules and route handlers with mocked database operations; they are not a live MongoDB or camera acceptance test.
- Actual backend model loading and blank-image inference: passed (blank image rejected with NO_FACE).
- No local MongoDB or application listeners were available during review. Real-person camera accuracy, actual database persistence, multi-station concurrency, and deployment still require the local acceptance steps above.

## Important operational limits

This is supervised face identification, not proven liveness detection. A printed photo or screen replay is not guaranteed to be rejected. The short-lived station URL is a bearer credential: anyone holding it can access the station endpoints. Do not share it with attendees. Keep manual identity checking and attendance fallback available.

The 0.45 distance threshold and 0.06 ambiguity margin are implementation defaults, not measured recognition accuracy. Validate with consenting users, venue lighting, and the actual kiosk camera. Update paper claims and evaluation results only after performing the new tests; the previous QR evaluation does not establish the accuracy of this new workflow.

No deployment, Git push, or production database changes were performed.
