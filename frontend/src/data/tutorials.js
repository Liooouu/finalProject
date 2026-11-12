const topic = (title, path, steps) => ({ title, path, steps });
const profile = topic('Profile & security', 'profile', [
  'Open your account menu in the top corner and choose My Profile.',
  'Check your personal and academic details. Ask an admin to correct program, year level or section.',
  'Use Security for face enrollment. A live camera enrollment and an uploaded photo follow different flows; an upload needs admin verification.',
]);
const notifications = topic('Notifications', 'notifications', [
  'Open the bell in the top corner to see updates.',
  'Select a notice to open its related page. Check the actual record for the latest status.',
]);
const events = topic('Manage events', 'events', [
  'Use All, Active or Past events to find an event. Use Create event to add one, or Edit event to update one.',
  'Set the school term, title, venue, start and end. Set Time In before or up to the start, and Time Out at or after the end.',
  'Use Add another day / activity only for an additional required period. Each day has its own attendance times; days with existing records are protected.',
]);
const excuses = topic('Excuse letters', 'reviews/excuses', [
  'Open Reviews, then Excuses. Search by student name or email and use Pending, Approved or Rejected.',
  'Read the explanation and supporting attachment before approving or rejecting. An eligible letter covers a recorded absence and is first submitted within seven days after the event or session ends.',
  'An organizer can review other students’ letters, including those from other organizers. An organizer cannot approve or reject their own letter.',
]);
export const TUTORIALS = {
  station: [
    topic('Using the face station', null, ['Wait until the scanner is ready and allow camera access when asked.', 'One student at a time: face the camera in good lighting and wait for the green confirmation.', 'Time In and Time Out use the selected day’s schedule. A failed scan does not count as attendance; ask an organizer for live ID attendance.']),
    topic('If the scanner cannot confirm a face', null, ['Keep your whole face in view and hold still. Avoid a bright light behind you.', 'Do not keep retrying an ambiguous match. Ask the organizer to use the supervised manual ID option.', 'If the camera or scanner is still preparing, follow its retry message. Keep the station supervised.']),
  ],
  public: [
    topic('Welcome to TrackED', '/', ['TrackED handles CCIT departmental event attendance and community service records.', 'Students use their own account. Administrators grant organizer access to student officers; do not share a personal account.']),
    topic('Sign in & create an account', '/auth', ['Choose Sign up if you do not have an account. Enter your name, email, password, program, year and section.', 'Verify your email with the latest six-digit code. Check Spam or Junk if it does not arrive.', 'After consent, enroll your face with the camera, or submit your own photo for admin verification if your camera is unavailable.']),
    topic('Forgot your password?', '/auth', ['Choose Forgot Password on the sign-in form.', 'Enter your registered email, use the emailed code, then choose a new password. Return to Sign in.']),
  ],
  student: [
    topic('Your dashboard', '', ['Your community service ledger shows your current balance and where changes came from.', 'Check the upcoming event’s Time In and Time Out. Attend both at the organizer’s station.', 'Records refresh automatically while online. Read the status before leaving the station.']),
    topic('Attend events', 'events', ['Open Attend Events to see the venue, schedule and your attendance for each day.', 'Look at the organizer’s face station during Time In and again during Time Out. Wait for the green confirmation.', 'If a scan cannot confirm your face, ask an organizer to take a live photo of your ID for manual review. A pending request is not yet approved attendance.']),
    topic('Community service ledger', 'community-service', ['Open Community Service to see your balance and each event’s contribution.', 'Use the record cards and page controls to inspect Time In, Time Out, penalties and approved removals.', 'An on-time completed day has 0 hours; completed late has 4. A missing Time Out has 2 hours, or 6 if also late. No valid Time In is an absence with 8 hours after the period closes.']),
    topic('Submit an excuse', 'submit-excuse', ['Choose a missed event or session that has a recorded absence.', 'Write your explanation, attach supporting evidence and submit within seven days after that event or session ends.', 'Open My excuse letters to check the submission time and decision. You can edit and resubmit until approved.']),
    profile, notifications,
  ],
  organizer: [
    topic('Your dashboard', '', ['The three top cards open Face station, Manual attendance and Excuse letters.', 'Live and upcoming events are below. Use the day arrows for a multi-day event and page controls for more events.']),
    events,
    topic('Face station', '', ['In the dashboard Face station card, select the event and the day or activity when needed.', 'Open the station and allow camera access. Wait until the scanner is ready; keep one face clearly in view.', 'The station uses that day’s Time In or Time Out window. Wait for the green attendance confirmation. Use supervised ID attendance if the scan cannot confirm a face.']),
    topic('Manual attendance & offline sync', 'manual-attendance', ['Choose the event and day, find the student, then photograph their actual school ID with the camera.', 'Confirm that the ID and selected student match, then submit. Capture time determines attendance; later review does not change it.', 'Prepare the event while online before an outage. Keep it open; pending ID captures stay on that device. Use Offline sync when connected again and wait for confirmation before clearing browser data.']),
    topic('Assigned manual reviews', 'reviews/manual', ['Open Reviews → ID Attendance → Assigned events. Select the event or use Search student.', 'For a pending request, inspect the ID, student details, action and capture time. Confirm the evidence, then Approve or Reject; give a reason when rejecting.', 'Only admins and assigned reviewers can approve manual attendance. You may review another student’s attendance, including a request you submitted, but never your own attendance. My requests tracks submissions rather than approval access.']),
    excuses, profile, notifications,
  ],
  admin: [
    topic('Your dashboard', '', ['The attendance rate summarizes recorded attendance.', 'Needs review opens ID attendance, face appeals and excuse letters. Manage users opens the student directory.', 'Admins monitor and review; organizers operate the face and ID attendance stations.']),
    events,
    topic('Manual reviews & reviewer assignments', 'reviews/manual', ['Open Reviews → ID Attendance. Select an event to find its pending requests.', 'Use Who can approve attendance? to select organizers, then Save reviewers. Uncheck an organizer and save to remove review access.', 'Inspect evidence and capture time, confirm the check, then approve or reject. Use Select all for eligible requests on the current page. Review date does not replace capture date.']),
    topic('Face appeals', 'reviews/face-appeals', ['Open Reviews → Face Appeals for enrollment uploads and identity requests.', 'Compare the request with the student account. Confirm identity before approval; reject an unsuitable request with a reason.', 'Use the page’s selection controls for eligible pending uploads. Approval activates the uploaded enrollment; submission alone does not.']),
    excuses,
    topic('Manage users & organizer access', 'users', ['Find a student by name or email and open the eye icon to view the account.', 'Edit program, year and section, then save. The face status indicates enrollment without displaying the enrollment photo.', 'Use Promote student or Remove organizer access in the account details. Promoted students retain their own student portal and records.']),
    topic('School terms & year levels', 'users', ['Use the school-term controls to set the current school year and semester. This does not automatically advance students.', 'For a bulk year-level update, choose the academic group and select the students who should advance; Select all speeds up selection. Review before confirming.', 'Check the displayed results and history. Undo is available for supported unchanged records; changed records are protected from being overwritten.']),
    topic('Attendance reports', 'reports', ['Open Attendance Report. Review the charts, then use the filters above the attendance records.', 'Recent records and page controls help inspect students’ Time In, Time Out and service hours.', 'Export the filtered report when needed. Deleting a report record does not erase the student’s incurred service penalty.']),
    topic('Admin profile', 'profile', ['Open your account menu and choose My Profile.', 'Update your personal details and profile picture. Removing your profile picture does not remove another student’s face enrollment.', 'Use Forgot Password on the sign-in page if you need account recovery.']), notifications,
  ],
};
export function tutorialIndex(role, pathname) {
  const prefix = `/${role}/dashboard`;
  const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length).replace(/^\//, '') : pathname;
  const topics = TUTORIALS[role] || TUTORIALS.public;
  const index = topics.findIndex(item => item.path && (relative === item.path || relative.startsWith(`${item.path}/`)));
  return Math.max(0, index);
}
