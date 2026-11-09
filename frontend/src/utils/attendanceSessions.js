export const sessionIdOf = value => String(value?._id || value || '');
export function sessionDayStatus(session, now = Date.now()) {
  if (now < +new Date(session.timeInOpen)) return 'upcoming';
  if (now <= +new Date(session.timeOutClose)) return 'live';
  return 'finished';
}
export const manilaInput = value => value && Number.isFinite(+new Date(value))
  ? new Date(+new Date(value) + 8 * 3600000).toISOString().slice(0, 16) : '';
export const inputInstant = value => value ? new Date(`${value}:00+08:00`).toISOString() : '';
export function sessionMode(session, now = Date.now(), eventStatus) {
  if (!session || eventStatus === 'closed') return 'closed';
  if ((eventStatus !== 'finished' || session.timeInPolicy === 'window_then_late')
    && now >= +new Date(session.timeInOpen) && now <= +new Date(session.timeInCutoff)) return 'time_in';
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
  if (record.timeInAt && !record.timeOutAt && record.pendingManualActions?.includes('time_out')) return 'Time Out under review';
  if (record.status === 'absent') return 'Absent';
  if (record.timeOutAt && !record.timeInAt) return 'No Time In';
  return record.timeInAt ? 'Awaiting time out' : 'Not checked in';
}

// Human-readable penalty reason shared by student cards, reports and ledgers,
// so the same record cannot be described differently on two screens.
export function attendancePenaltyLabel(record) {
  if (!record) return 'No attendance recorded yet.';
  if (record.status === 'excused') return 'Approved excuse: 0 penalty hours';
  if (record.status === 'absent') return record.session ? 'No valid Time In: 8 penalty hours' : 'Absent: 8 penalty hours';
  // Legacy Time In-only records predate arrival/completion fields.
  if (!record.session) return record.status === 'late' ? 'Late check-in: 4 penalty hours' : record.status === 'present' ? 'Present: 0 penalty hours' : '';
  if (record.completionStatus === 'incomplete') {
    return record.arrivalStatus === 'late'
      ? 'Late (4h) + missing Time Out (2h): 6h'
      : 'Missing Time Out: 2 penalty hours';
  }
  if (record.completionStatus === 'pending') return record.timeInAt
    ? (record.pendingManualActions?.includes('time_out') ? 'Time Out under admin review' : 'Awaiting Time Out')
    : 'Time In not confirmed · no absence penalty yet';
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
    if (previous && clock < previous && (row.timeInPolicy !== 'window_then_late' || row[`_${group.id}Overnight`] === true)) day = new Date(+new Date(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    next[key] = inputInstant(`${day}T${clock}`);
    previous = clock;
  }
  return next;
}

export const ATTENDANCE_GROUPS = [
  { id: 'timeIn', title: 'Time In', fields: [['timeInOpen', 'Opens'], ['timeInCutoff', 'Accept until']] },
  { id: 'timeOut', title: 'Time Out', fields: [['timeOutOpen', 'Opens'], ['timeOutClose', 'Closes']] },
];
export const attendanceGroupsFor = row => row?.timeInPolicy === 'window_then_late'
  ? [{ id: 'timeIn', title: 'Time In', fields: [['timeInOpen', 'Opens'], ['onTimeDeadline', 'On-time until']] }, ATTENDANCE_GROUPS[1]]
  : ATTENDANCE_GROUPS;
export const onTimeWindowEnd = row => row?.timeInPolicy === 'window_then_late' ? row.onTimeDeadline : row.timeInCutoff;
export const emptyEventAttendance = index => ({ name: index === 0 ? 'Event attendance' : `Day / activity ${index + 1}`, ...(index > 0 ? { activityStart: '', activityEnd: '' } : {}), timeInPolicy: 'window_then_late', timeInOpen: '', onTimeDeadline: '', timeInCutoff: '', timeOutOpen: '', timeOutClose: '' });
export function activityScheduleFields(row, fallbackDate = '') {
  if (!row) return { startDate: fallbackDate || '', startTime: '', endDate: fallbackDate || '', endTime: '', ...({}) };
  const from = manilaInput(row.activityStart), to = manilaInput(row.activityEnd);
  const startDate = from.slice(0, 10) || row._timeInDate || manilaInput(row.timeInOpen).slice(0, 10) || fallbackDate;
  return { startDate, startTime: from.slice(11) || '', endDate: to.slice(0, 10) || row._timeOutDate || manilaInput(row.timeOutOpen).slice(0, 10) || startDate, endTime: to.slice(11) || '', ...row._activitySchedule };
}
export function updateActivitySchedule(row, key, value, fallbackDate = '') {
  const previous = activityScheduleFields(row, fallbackDate);
  const fields = { ...previous, [key]: value };
  if (key === 'startDate' && previous.endDate === previous.startDate) fields.endDate = value;
  let next = { ...row, _activitySchedule: fields,
    activityStart: fields.startDate && fields.startTime ? inputInstant(`${fields.startDate}T${fields.startTime}`) : '',
    activityEnd: fields.endDate && fields.endTime ? inputInstant(`${fields.endDate}T${fields.endTime}`) : '' };
  for (const [dateKey, groupIndex] of [['startDate', 0], ['endDate', 1]]) if (fields[dateKey] !== previous[dateKey] || key === dateKey) {
    const group = attendanceGroupsFor(row)[groupIndex];
    if (group) next = updateAttendanceGroup(next, group, fields[dateKey]);
  }
  return next;
}
// The displayed Time In range is on time; arrival remains possible, but late,
// until immediately before Time Out opens. Existing saved rules stay intact.
export function syncAttendanceDeadlines(value) {
  return { ...value, attendanceSessions: (value.attendanceSessions || []).map(row => row.timeInPolicy === 'window_then_late' ? ({
    ...row,
    onTimeDeadline: row.onTimeDeadline ? new Date(Math.floor(+new Date(row.onTimeDeadline) / 60000) * 60000 + 59999).toISOString() : '',
    timeInCutoff: row.timeOutOpen ? new Date(+new Date(row.timeOutOpen) - 1).toISOString() : '',
  }) : row) };
}
export function rebaseEventAttendanceDates(previous, next) {
  const base = previous.attendanceSessions?.[0];
  if (!base || base.name !== 'Event attendance') return next;
  let row = base;
  for (const group of attendanceGroupsFor(base)) {
    const before = group.id === 'timeIn' ? previous.date : previous.endDate || previous.date;
    const after = group.id === 'timeIn' ? next.date : next.endDate || next.date;
    if (before !== after) row = updateAttendanceGroup(row, group, after || '');
  }
  return row === base ? next : { ...next, attendanceSessions: [row, ...previous.attendanceSessions.slice(1)] };
}
export function attendanceBoundaryIssue(value) {
  for (const [index, row] of (value.attendanceSessions || []).entries()) {
    if (row.timeInPolicy !== 'window_then_late') continue;
    const start = index === 0 ? +new Date(`${value.date}T${value.time}:00+08:00`) : +new Date(row.activityStart || '');
    const end = index === 0 ? +new Date(`${value.endDate || value.date}T${value.endTime || '23:59'}:00+08:00`) : +new Date(row.activityEnd || '');
    const prefix = index ? `${row.name}: ` : '';
    const deadline = +new Date(row.onTimeDeadline);
    const entry = +new Date(row.timeInOpen);
    if (Number.isFinite(entry) && Number.isFinite(deadline) && deadline < entry) return `${prefix}Time In ends before it opens. Choose an opening time before the on-time deadline.`;
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) return `${prefix}End time must be after Start time. Choose the next end date if this activity continues after midnight.`;
    if (Number.isFinite(start) && Number.isFinite(deadline) && Math.floor(deadline / 60000) > Math.floor(start / 60000)) return `${prefix}Time In must end at or before the start time. For a 9:00 AM start, 7:00–9:00 AM is valid; 9:01 AM is not.`;
    const exit = +new Date(row.timeOutOpen);
    if (Number.isFinite(end) && Number.isFinite(exit) && exit < end) return `${prefix}Time Out cannot open before the end time. For a 5:00 PM end, 5:00–6:00 PM is valid; 4:59–6:00 PM is not.`;
    if (Number.isFinite(+new Date(row.timeOutClose)) && Number.isFinite(exit) && +new Date(row.timeOutClose) <= exit) return `${prefix}Time Out closes before it opens. Choose a later closing time, or explicitly select “Closes the next day” for an overnight window.`;
  }
  return '';
}
export function attendanceSetupIssue(value) {
  const start = +new Date(`${value.date}T${value.time}:00+08:00`);
  const end = +new Date(`${value.endDate || value.date}T${value.endTime || '23:59'}:00+08:00`);
  if (!Number.isFinite(start)) return 'Select the event start date and time first.';
  if (!Number.isFinite(end) || end <= start) return 'End time must be after Start time. Choose a later end time, or the next date for an overnight event.';
  const boundaryIssue = attendanceBoundaryIssue(value);
  if (boundaryIssue) return boundaryIssue;
  if (!value.attendanceSessions?.length) return 'Set the Time In and Time Out times below the event schedule.';
  for (const row of value.attendanceSessions) {
    const prefix = row.name === 'Event attendance' ? '' : `${row.name}: `;
    if (row !== value.attendanceSessions[0] && ('activityStart' in row || !row._id)) {
      if (!Number.isFinite(+new Date(row.activityStart || ''))) return `${prefix}Select this day or activity's start date and time.`;
      if (!Number.isFinite(+new Date(row.activityEnd || ''))) return `${prefix}Select this day or activity's end date and time.`;
    }
    const times = Object.fromEntries(attendanceGroupsFor(row).flatMap(group => group.fields.map(([key,label]) => [key, { at: +new Date(row[key]), label: `${group.title} ${label.toLowerCase()}` }])));
    times.onTimeDeadline = { at: +new Date(row.onTimeDeadline), label: 'Time In on-time deadline' };
    for (const value of Object.values(times)) if (!Number.isFinite(value.at)) return `${prefix}Select ${value.label}.`;
    if (times.onTimeDeadline.at < times.timeInOpen.at) return `${prefix}On-time until is earlier than Time In opens. Choose an on-time deadline at or after the opening time.`;
    const cutoff = +new Date(row.timeInCutoff);
    if (row.timeInPolicy !== 'window_then_late' && cutoff < times.onTimeDeadline.at) return `${prefix}Accept until must be at or after the on-time deadline.`;
    if (times.timeOutOpen.at <= times.onTimeDeadline.at || times.timeOutOpen.at <= cutoff) return `${prefix}Time In overlaps Time Out. Move Time Out opens later than the Time In range.`;
    if (times.timeOutClose.at <= times.timeOutOpen.at) return `${prefix}Time Out closes before it opens. Choose a later closing time.`;
    const arrivalEnd = row.timeInPolicy === 'window_then_late' ? times.onTimeDeadline.at : cutoff;
    const rowEnd = row.activityEnd ? +new Date(row.activityEnd) : end;
    const endLimit = row.timeInPolicy === 'window_then_late' ? Math.floor(rowEnd / 60000) * 60000 + 59999 : rowEnd;
    if (arrivalEnd > endLimit) return `${prefix}Time In extends beyond the event. Move its on-time deadline earlier or extend the event end time.`;
  }
  const rows = value.attendanceSessions;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const windows = row => [[+new Date(row.timeInOpen), +new Date(row.timeInCutoff)], [+new Date(row.timeOutOpen), +new Date(row.timeOutClose)]];
    if (windows(rows[i]).some(a => windows(rows[j]).some(b => a[0] <= b[1] && b[0] <= a[1]))) return `${rows[i].name} overlaps ${rows[j].name}. Move one attendance period so their Time In and Time Out windows do not overlap.`;
  }
  return '';
}
