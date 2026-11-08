export const sessionIdOf = value => String(value?._id || value || '');
export const manilaInput = value => value && Number.isFinite(+new Date(value))
  ? new Date(+new Date(value) + 8 * 3600000).toISOString().slice(0, 16) : '';
export const inputInstant = value => value ? new Date(`${value}:00+08:00`).toISOString() : '';
export function sessionMode(session, now = Date.now()) {
  if (now >= +new Date(session.timeInOpen) && now <= +new Date(session.timeInCutoff)) return 'time_in';
  if (now >= +new Date(session.timeOutOpen) && now <= +new Date(session.timeOutClose)) return 'time_out';
  return 'closed';
}
export function defaultAttendanceSession(value, index = 0) {
  const start = +new Date(`${value.date}T${value.time || '08:00'}:00+08:00`);
  const end = +new Date(`${value.endDate || value.date}T${value.endTime || '23:59'}:00+08:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const duration = end - start, minute = 60000;
  const instant = offset => new Date(start + Math.round(offset / minute) * minute).toISOString();
  return { _auto: true, name: `Session ${index + 1}`, timeInOpen: instant(0), onTimeDeadline: instant(Math.min(30 * minute, duration / 4)),
    timeInCutoff: instant(duration / 2), timeOutOpen: instant(duration * 0.8), timeOutClose: new Date(end).toISOString() };
}
export function attendanceCompletion(record) {
  if (!record?.session) return 'Time In only';
  if (record.status === 'excused') return 'Excused';
  if (record.completionStatus === 'completed') return 'Completed';
  if (record.completionStatus === 'incomplete') return 'Incomplete';
  if (record.status === 'absent') return 'Absent';
  return record.timeInAt ? 'Awaiting time out' : 'Not checked in';
}

// Human-readable penalty reason shared by student cards, reports and ledgers,
// so the same record cannot be described differently on two screens.
export function attendancePenaltyLabel(record) {
  if (!record) return 'No attendance recorded yet.';
  if (record.status === 'excused') return 'Approved excuse: 0 penalty hours';
  if (record.status === 'absent') return 'Absent: 8 penalty hours';
  // Legacy Time In-only records predate arrival/completion fields.
  if (!record.session) return record.status === 'late' ? 'Late check-in: 4 penalty hours' : record.status === 'present' ? 'Present: 0 penalty hours' : '';
  if (record.completionStatus === 'incomplete') {
    return record.arrivalStatus === 'late'
      ? 'Late (4h) + missing Time Out (2h): 6h'
      : 'Missing Time Out: 2 penalty hours';
  }
  if (record.completionStatus === 'pending') return record.timeInAt ? 'Awaiting Time Out' : 'Time In not confirmed · no absence penalty yet';
  return record.arrivalStatus === 'late'
    ? 'Late Time In: 4 penalty hours'
    : 'On-time Time In: 0 penalty hours';
}

// The editor displays one date per arrival/departure group. Stored values stay
// full Manila-resolved instants, including windows that cross midnight.
export const attendanceClock = (row, key) => manilaInput(row[key]).slice(11, 16) || row._clocks?.[key] || '';
export function attendanceGroupDate(row, group, fallback = '') {
  const draft = row[`_${group.id}Date`];
  return draft !== undefined ? draft : group.fields.map(([key]) => manilaInput(row[key]).slice(0, 10)).find(Boolean) || fallback;
}
export function updateAttendanceGroup(row, group, date, changedKey, time) {
  const clocks = Object.fromEntries(group.fields.map(([key]) => [key, key === changedKey ? time : attendanceClock(row, key)]));
  const next = { ...row, [`_${group.id}Date`]: date, _clocks: { ...row._clocks, ...clocks } };
  let day = date, previous = '';
  for (const [key] of group.fields) {
    const clock = clocks[key];
    if (!date || !clock) { next[key] = ''; continue; }
    if (previous && clock < previous) day = new Date(+new Date(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    next[key] = inputInstant(`${day}T${clock}`);
    previous = clock;
  }
  return next;
}

export const ATTENDANCE_GROUPS = [
  { id: 'timeIn', title: 'Time In', fields: [['timeInOpen', 'Opens'], ['timeInCutoff', 'Accept until']] },
  { id: 'timeOut', title: 'Time Out', fields: [['timeOutOpen', 'Opens'], ['timeOutClose', 'Closes']] },
];
export const emptyEventAttendance = index => ({ name: index === 0 ? 'Event attendance' : `Additional attendance ${index}`, timeInOpen: '', onTimeDeadline: '', timeInCutoff: '', timeOutOpen: '', timeOutClose: '' });
// The event start already defines punctuality. Additional periods use their
// own opening time; keep the API's deadline without another user input.
export function syncAttendanceDeadlines(value) {
  return { ...value, attendanceSessions: (value.attendanceSessions || []).map((row, index) => ({
    ...row,
    onTimeDeadline: index === 0 && value.date && value.time
      ? inputInstant(`${value.date}T${value.time}`) : row.timeInOpen,
  })) };
}
export function rebaseEventAttendanceDates(previous, next) {
  const base = previous.attendanceSessions?.[0];
  if (!base || base.name !== 'Event attendance') return next;
  let row = base;
  for (const group of ATTENDANCE_GROUPS) {
    const before = group.id === 'timeIn' ? previous.date : previous.endDate || previous.date;
    const after = group.id === 'timeIn' ? next.date : next.endDate || next.date;
    if (before !== after) row = updateAttendanceGroup(row, group, after || '');
  }
  return row === base ? next : { ...next, attendanceSessions: [row, ...previous.attendanceSessions.slice(1)] };
}
export function attendanceSetupIssue(value) {
  if (!value.attendanceSessions?.length) return 'Set the Time In and Time Out times below the event schedule.';
  for (const row of value.attendanceSessions) {
    const prefix = row.name === 'Event attendance' ? '' : `${row.name}: `;
    const times = Object.fromEntries(ATTENDANCE_GROUPS.flatMap(group => group.fields.map(([key,label]) => [key, { at: +new Date(row[key]), label: `${group.title} ${label.toLowerCase()}` }])));
    times.onTimeDeadline = { at: +new Date(row.onTimeDeadline), label: 'event start time' };
    for (const value of Object.values(times)) if (!Number.isFinite(value.at)) return `${prefix}Select ${value.label}.`;
    if (times.onTimeDeadline.at < times.timeInOpen.at) return `${prefix}Time In must open at or before the start time.`;
    if (times.timeInCutoff.at < times.onTimeDeadline.at) return `${prefix}Accept until must be at or after the start time.`;
    if (times.timeOutOpen.at <= times.timeInCutoff.at) return `${prefix}Time Out must open after Time In closes.`;
    if (times.timeOutClose.at <= times.timeOutOpen.at) return `${prefix}Time Out must close after it opens.`;
    const end = +new Date(`${value.endDate || value.date}T${value.endTime || '23:59'}:00+08:00`);
    if (Number.isFinite(end) && times.timeInCutoff.at > end) return `${prefix}Time In must close by the event end time.`;
  }
  return '';
}
