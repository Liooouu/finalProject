import { TUTORIALS, tutorialIndex } from './tutorials';

const targets = {
  dashboard: ['[data-guide-card="Community service ledger"] .fd-rail', '[data-guide-card="Attendance rate"] .fd-rail', '.organizer-face-card .fd-rail'],
  events: ['[data-guide="view-options"]', 'main article', '[data-guide="page-header"]'],
  'community-service': ['[data-guide-card] .fd-rail', 'main article', 'main table'],
  'submit-excuse': ['main form', 'main select', '[data-guide="tabs"]'],
  'manual-attendance': ['main select', 'main input[placeholder*="name"]', '[data-guide="tabs"]'],
  'reviews-manual': ['[data-guide="tabs"]', 'main input[placeholder*="name"]', 'main select'],
  'reviews-excuses': ['[data-guide="tabs"]', 'main input[placeholder*="name"]', '[data-guide="view-options"]'],
  'reviews-face-appeals': ['[data-guide="tabs"]', '[data-guide="page-header"]'],
  users: ['[data-guide="tabs"]', 'main input[placeholder*="name"]', 'main table'],
  reports: ['[data-guide="tabs"]', '.admin-report-filter', 'main table'],
  profile: ['[aria-label="Profile sections"]', 'main form', '[data-guide="page-header"]'],
  notifications: ['[data-guide="page-header"]', 'main'],
};
const examples = {
  dashboard: ['Check your service balance before opening its detailed breakdown.', 'Use the day arrows to check each day’s Time In and Time Out.', 'After a successful scan, check the updated attendance status here.'],
  events: ['Choose Active events to find live or upcoming events.', 'Event: 9 AM–5 PM. Time In: 7–9 AM. Time Out: 5–6 PM.', 'Add Day 2 only for another required attendance period.'],
  'community-service': ['Open an event record to see why hours were added or removed.', 'Time In recorded + Time Out recorded shows a completed period.', 'On-time with missing Time Out: 2 hours. Late with missing Time Out: 6 hours.'],
  'submit-excuse': ['Choose the event where you were recorded absent.', 'Attach your supporting document before submitting.', 'A pending or rejected letter can be updated; an approved letter cannot.'],
  'manual-attendance': ['Choose the correct event and day before the student.', 'Check that the photographed ID belongs to the selected account.', 'Keep the prepared page open during an outage; sync queued captures when connected again.'],
  'reviews-manual': ['Choose ID Attendance, then find the student or event.', 'Check the ID and captured time, confirm the checkbox, then approve.', 'An assigned organizer can approve another student’s request, but not their own attendance.'],
  'reviews-excuses': ['Choose Excuses, then Pending.', 'Read the explanation and attachment before deciding.', 'Your own letter can be visible, but you cannot approve or reject it.'],
  'reviews-face-appeals': ['Select Face Appeals for pending enrollment uploads.', 'Check the student’s identity and photo before approval.', 'Uploaded enrollment becomes active after admin approval.'],
  users: ['Open the eye icon beside the student’s name.', 'Correct BSIT / Year 2 / Section A, then save.', 'Promote a student officer here; their student records remain available.'],
  reports: ['Choose Attendance, Events or Users.', 'Filter by event or program to narrow the records.', 'Export the filtered records for a matching download.'],
  profile: ['Choose Academic record to view your academic details.', 'Ask an administrator to correct incorrect academic details.', 'An uploaded face photo requires admin verification.'],
  notifications: ['Open a notice about an event or decision.', 'Follow the notice to its record and check its current status.'],
};

export function activeGuideSection() {
  const localViews = '[aria-label="Profile sections"], [aria-label="Attendance desk views"], [aria-label="Manual request views"], [aria-label="Excuse letter view"]';
  const local = [...document.querySelectorAll(localViews)].flatMap(group => [...group.querySelectorAll('[data-guide-option][aria-pressed="true"]')]);
  const node = [...local, ...document.querySelectorAll('[data-guide-tab][aria-selected="true"]')].find(item => item.getClientRects().length);
  return node?.getAttribute('data-guide-tab') || node?.getAttribute('data-guide-option') || '';
}

export function pageGuide(role, pathname, search, section = '') {
  let root = pathname.replace(new RegExp(`^/${role}/dashboard/?`), '').split('/').filter(Boolean).slice(0, 2).join('-') || 'dashboard';
  if (root.startsWith('events-')) root = 'events';
  if (root.startsWith('manual-attendance-')) root = 'manual-attendance';
  if (root === 'reviews') root = 'reviews-manual';
  if (root === 'events' && new URLSearchParams(search).get('create') === '1') root = 'events-create';
  let topic = (TUTORIALS[role] || TUTORIALS.public)[tutorialIndex(role, pathname)];
  if (role === 'public') { root = pathname === '/auth' ? 'auth' : 'welcome'; topic = TUTORIALS.public[root === 'auth' ? 1 : 0]; }
  if (role === 'station') { root = 'station'; topic = TUTORIALS.station[0]; }
  const base = root === 'events-create' ? 'events' : root;
  const navPath = `/${role}/dashboard${base === 'dashboard' ? '' : `/${base.startsWith('reviews-') ? 'reviews' : base}`}`;
  const navigation = [`[data-guide-nav="${navPath}"]`, '[aria-label="Open navigation"]', '[aria-label="Account menu"]'];
  let steps = topic.steps.map((description, i) => ({ title: `${topic.title} · ${i + 1}`, description, example: examples[base]?.[i], targets: [targets[base]?.[i], ...(targets[base] || []), '[data-guide="page-header"]'].filter(Boolean) }));
  if (root === 'dashboard' && role === 'student') steps = [
    { title: 'Community service ledger', description: topic.steps[0], example: examples.dashboard[0], targets: ['[data-guide-card="Community service ledger"] .fd-rail'] },
    { title: 'Upcoming events', description: topic.steps[1], example: examples.dashboard[1], targets: ['[data-guide-card^="Upcoming events"] .fd-rail'] },
    { title: 'Recent activity', description: topic.steps[2], example: examples.dashboard[2], targets: ['[data-guide-card="Recent activity"] .fd-rail'] },
  ];
  if (root === 'dashboard' && role === 'admin') steps = [
    { title: 'Attendance rate', description: topic.steps[0], example: 'Open Attendance reports to inspect the records behind the rate.', targets: ['.admin-home-rate h2', '[data-guide-card="Attendance rate"] .fd-rail'] },
    { title: 'Reviews', description: 'Review ID attendance, face appeals and excuse letters from here.', example: 'Open a pending review, inspect its evidence, then approve or reject.', targets: ['.admin-home-reviews h2', '.admin-review-links', '[href="/admin/dashboard/reviews/manual"]'] },
    { title: 'Manage users', description: 'Open student accounts to correct academic details or change organizer access.', example: 'Select the eye icon beside a student to view their account.', targets: ['.admin-home-users'] },
  ];
  if (root === 'dashboard' && role === 'organizer') steps = [
    { title: 'Face station', description: 'Choose an event and day, then open the station for face attendance.', example: 'Wait for scanner readiness and the green confirmation after each student.', targets: ['.organizer-face-card .fd-rail'] },
    { title: 'Manual attendance', description: 'Use live ID attendance when a student cannot complete the face scan.', example: 'Select the student, photograph their ID, then submit for review.', targets: ['.organizer-manual-card .fd-rail'] },
    { title: 'Excuse letters', description: 'Open this card to review other students’ excuse letters.', example: 'Read the explanation and evidence before deciding.', targets: ['.organizer-excuses-card .fd-rail'] },
    { title: 'Live & upcoming events', description: 'Check the venue and each day’s Time In and Time Out.', example: 'Use day arrows for Day 2 and event page controls for more events.', targets: ['.organizer-upcoming-card .fd-rail'] },
  ];
  if (root === 'events-create') steps = [
    { title: 'Event details', description: 'Enter the title, venue, school term and event schedule.', example: 'CCIT Assembly · MPCC · 9 AM–5 PM.', targets: ['main input[name="title"]', 'main form', '[data-guide="page-header"]'] },
    { title: 'Time In and Time Out', description: 'Time In must end by the event start. Time Out must open at or after the event end.', example: 'Time In 7–9 AM. Event 9 AM–5 PM. Time Out 5–6 PM.', targets: ['main input[type="time"]', 'main form'] },
    { title: 'Additional days', description: 'Add another day / activity only for another required attendance period.', example: 'Day 2 has its own start, end, Time In and Time Out.', targets: ['main form', '[data-guide="page-header"]'] },
  ];
  if (root === 'profile' && section === 'academic') steps = [
    { title: 'Academic record', description: 'View your program, year, section and school year.', example: 'BSIT · Year 2 · Section A · 2026–2027.', targets: ['[data-guide-card="Academic standing"] .fd-rail', '[aria-label="Profile sections"]'] },
    { title: 'Correcting your details', description: 'Ask an administrator to correct academic information. Changing the current term does not automatically advance year levels.', example: 'Ask the admin to correct an incorrect section in your student account.', targets: ['[data-guide-card="Academic standing"] .fd-rail'] },
  ];
  if (root === 'profile' && section === 'security') steps = [{ title: 'Face enrollment', description: 'Check your enrollment status and use the available enrollment or replacement action.', example: 'A clear live camera photo enrolls directly. An upload needs admin verification.', targets: ['[aria-label="Profile sections"]', 'main form'] }];
  if (root === 'users' && ['terms', 'advancement'].includes(section)) {
    const yearTopic = TUTORIALS.admin.find(item => item.title === 'School terms & year levels');
    steps = (section === 'terms' ? yearTopic.steps.slice(0, 1) : yearTopic.steps.slice(1)).map(description => ({ title: section === 'terms' ? 'School terms' : 'Year levels', description, example: section === 'terms' ? 'Set 2026–2027 and 1st Semester as the current department term.' : 'Choose the academic group, select students to advance, then review the result.', targets: ['[data-guide="tabs"]', 'main select'] }));
  }
  if (root === 'reports' && ['events', 'users'].includes(section)) steps = [{ title: section === 'events' ? 'Event report' : 'User report', description: section === 'events' ? 'Review events by status and inspect the event list below.' : 'Review account roles. Students with organizer access are counted as organizers in this report.', example: 'Use the available export to download this report.', targets: ['[data-guide="tabs"]'] }];
  if ((root === 'manual-attendance' && section === 'requests') || (root === 'reviews-manual' && section === 'mine')) steps = [{ title: 'My requests', description: 'Track the attendance requests you submitted and check whether each is pending, approved or rejected.', example: 'Pending means the request still needs a decision; it is not yet confirmed attendance.', targets: ['[aria-label="Attendance desk views"]', '[aria-label="Manual request views"]'] }];
  if (root === 'manual-attendance' && section === 'records') steps = [{ title: 'Attendance records', description: 'Inspect this event’s student attendance. Select an existing record when a correction is needed.', example: 'A correction uses the verified attendance time and still requires an eligible reviewer.', targets: ['[aria-label="Attendance desk views"]', 'main table'] }];
  if (root === 'submit-excuse' && section === 'history') steps = [{ title: 'My letters', description: 'See when you submitted your letter and whether it is pending, approved or rejected.', example: 'Open a letter to edit and resubmit while it is not yet approved.', targets: ['[aria-label="Excuse letter view"]', 'main article'] }];
  if (role === 'public') steps = topic.steps.map(description => ({ title: topic.title, description, targets: ['.auth-form-column form', '.auth-form-column', 'form', '[data-guide="page-header"]'] }));
  if (role === 'station') steps = topic.steps.map(description => ({ title: topic.title, description, targets: ['video', 'canvas'] }));
  if (!['public', 'station'].includes(role)) steps.unshift({ title: topic.title, description: 'Use this navigation to open the page. Follow the highlighted controls, or open another page whenever needed.', example: 'On a phone, use the hamburger menu to find the other pages.', targets: section ? [`[data-guide-tab="${section}"]`, `[data-guide-option="${section}"][aria-pressed="true"]`, ...navigation] : navigation });
  return { key: `${root}${section ? `:${section}` : ''}`, title: topic.title, steps };
}
