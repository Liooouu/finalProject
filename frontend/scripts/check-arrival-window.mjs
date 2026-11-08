import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { normalizeSessions, validateSessions } = require('../../backend/services/sessionSchedule');
const { classify } = require('../../backend/services/penaltyCalc');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { emptyEventAttendance, attendanceGroupsFor, updateAttendanceGroup, attendanceSetupIssue, attendanceBoundaryIssue } = await server.ssrLoadModule('/src/utils/attendanceSessions.js');
  const { applyEventField } = await server.ssrLoadModule('/src/utils/academicPeriods.js');
  let event = { date: '2026-11-08', time: '20:15', endDate: '2026-11-08', endTime: '20:20', attendanceSessions: [emptyEventAttendance(0)] };
  const change = (group, field, value) => {
    const row = event.attendanceSessions[0];
    const next = updateAttendanceGroup(row, attendanceGroupsFor(row).find(item => item.id === group), event.date, field, value);
    event = applyEventField(event, { name: 'attendanceSessions', value: [next] });
  };
  change('timeIn', 'timeInOpen', '20:13'); change('timeIn', 'onTimeDeadline', '20:15');
  change('timeOut', 'timeOutOpen', '20:20'); change('timeOut', 'timeOutClose', '20:25');
  assert.equal(attendanceSetupIssue(event), '');
  const [saved] = normalizeSessions(JSON.parse(JSON.stringify(event.attendanceSessions)));
  assert.equal(validateSessions([saved], new Date('2026-11-08T20:15:00+08:00'), new Date('2026-11-08T20:20:00+08:00')), null);
  for (const clock of ['20:13:01', '20:14:00', '20:15:59']) {
    assert.equal(classify({ session: saved, timeInAt: new Date(`2026-11-08T${clock}+08:00`), timeOutAt: new Date('2026-11-08T20:22:00+08:00') }).hours, 0);
  }
  const retimed = applyEventField(event, { name: 'time', value: '20:16' });
  assert.equal(retimed.attendanceSessions[0].onTimeDeadline, event.attendanceSessions[0].onTimeDeadline);
  assert.match(attendanceSetupIssue({ ...event, endTime: '20:12' }), /End time must be after Start time/);
  assert.match(attendanceSetupIssue({ ...event, attendanceSessions: [{ ...saved, timeOutOpen: saved.onTimeDeadline }] }), /Time Out cannot open before/);
  assert.match(attendanceSetupIssue({ ...event, attendanceSessions: [{ ...saved, timeOutClose: saved.timeOutOpen }] }), /closes before/);
  const { default: EventAttendanceSchedule } = await server.ssrLoadModule('/src/components/shared/EventAttendanceSchedule.jsx');
  const schedule = renderToStaticMarkup(React.createElement(EventAttendanceSchedule, { event }));
  assert.match(schedule, /8:13 PM – 8:15 PM/);
  assert.doesNotMatch(schedule, /8:19/);
  const { default: Guide } = await server.ssrLoadModule('/src/components/shared/AttendanceScheduleGuide.jsx');
  const guide = renderToStaticMarkup(React.createElement(Guide, { issue: 'Time In overlaps Time Out.', onClose() {} }));
  assert.match(guide, /Check the attendance schedule/);
  assert.match(guide, /Back to the schedule/);
  assert.equal(renderToStaticMarkup(React.createElement(Guide, { issue: '', onClose() {} })), '', 'guidance is absent until there is an invalid schedule');
  const partial = { date: '2026-11-08', time: '09:00', endTime: '17:00', attendanceSessions: [{ ...emptyEventAttendance(0), timeInOpen: '2026-11-08T07:00:00+08:00', onTimeDeadline: '2026-11-08T09:00:59.999+08:00' }] };
  assert.equal(attendanceBoundaryIssue(partial), '', 'incomplete valid form must not raise a boundary popup');
  assert.match(attendanceBoundaryIssue({ ...partial, attendanceSessions: [{ ...partial.attendanceSessions[0], onTimeDeadline: '2026-11-08T09:01:00+08:00' }] }), /Time In must end/);
  assert.match(attendanceBoundaryIssue({ ...partial, attendanceSessions: [{ ...partial.attendanceSessions[0], timeOutOpen: '2026-11-08T16:59:00+08:00' }] }), /Time Out cannot open before/);
  const { updateActivitySchedule, syncAttendanceDeadlines } = await server.ssrLoadModule('/src/utils/attendanceSessions.js');
  let added = emptyEventAttendance(1);
  for (const [key, value] of [['startDate', '2026-11-09'], ['startTime', '09:00'], ['endTime', '17:00']]) added = updateActivitySchedule(added, key, value, event.date);
  const enterGroup = attendanceGroupsFor(added)[0], exitGroup = attendanceGroupsFor(added)[1];
  added = updateAttendanceGroup(added, enterGroup, '2026-11-09', 'timeInOpen', '07:00');
  added = updateAttendanceGroup(added, enterGroup, '2026-11-09', 'onTimeDeadline', '09:00');
  added = updateAttendanceGroup(added, exitGroup, '2026-11-09', 'timeOutOpen', '17:00');
  added = updateAttendanceGroup(added, exitGroup, '2026-11-09', 'timeOutClose', '18:00');
  const twoDays = syncAttendanceDeadlines({ ...event, attendanceSessions: [...event.attendanceSessions, added] });
  assert.equal(attendanceSetupIssue(twoDays), '');
  assert.equal(validateSessions(normalizeSessions(twoDays.attendanceSessions), new Date('2026-11-08T20:15:00+08:00'), new Date('2026-11-08T20:20:00+08:00')), null);
  const reversed = updateAttendanceGroup(added, exitGroup, '2026-11-09', 'timeOutClose', '10:00');
  assert.match(reversed.timeOutClose, /^2026-11-09T02:00/, 'reversed input must not silently jump to Nov 10');
  assert.match(attendanceBoundaryIssue({ ...twoDays, attendanceSessions: [twoDays.attendanceSessions[0], reversed] }), /closes before/);
  const overnight = updateAttendanceGroup({ ...reversed, _timeOutOvernight: true }, exitGroup, '2026-11-09');
  assert.match(overnight.timeOutClose, /^2026-11-10T02:00/, 'overnight rollover requires explicit consent');
  const { default: Editor } = await server.ssrLoadModule('/src/components/shared/SessionSetupEditor.jsx');
  const extraForm = renderToStaticMarkup(React.createElement(Editor, { value: twoDays, onChange() {}, extrasOnly: true }));
  assert.match(extraForm, /Start date/); assert.match(extraForm, /Start time/);
  assert.match(extraForm, /End date/); assert.match(extraForm, /End time/);
  assert.equal((extraForm.match(/type="date"/g) || []).length, 2, 'additional day does not repeat dates inside Time In and Time Out');
  const protectedForm = renderToStaticMarkup(React.createElement(Editor, {
    value: { ...twoDays, attendanceSessions: [twoDays.attendanceSessions[0], { ...added, _id: 'used-day' }, { ...added, _id: 'unused-day', name: 'Future day' }] },
    onChange() {}, extrasOnly: true, lockedSessions: [{ sessionId: 'used-day', reason: 'Attendance records already use this day.' }],
  }));
  const dateFields = [...protectedForm.matchAll(/<input[^>]*id="activity-(\d)-startDate"[^>]*>/g)];
  assert.ok(dateFields.find(field => field[1] === '1')[0].includes('disabled'), 'used day must be read-only');
  assert.ok(!dateFields.find(field => field[1] === '2')[0].includes('disabled'), 'unused day stays editable in the same event');
  assert.match(protectedForm, /Schedule protected: Attendance records already use this day/);
  console.log('Arrival-window UI → API → penalty regression and schedule guidance passed.');
} finally { await server.close(); }
