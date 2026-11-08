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
  const { emptyEventAttendance, attendanceGroupsFor, updateAttendanceGroup, attendanceSetupIssue } = await server.ssrLoadModule('/src/utils/attendanceSessions.js');
  const { applyEventField } = await server.ssrLoadModule('/src/utils/academicPeriods.js');
  let event = { date: '2026-11-08', time: '20:13', endDate: '2026-11-08', endTime: '20:20', attendanceSessions: [emptyEventAttendance(0)] };
  const change = (group, field, value) => {
    const row = event.attendanceSessions[0];
    const next = updateAttendanceGroup(row, attendanceGroupsFor(row).find(item => item.id === group), event.date, field, value);
    event = applyEventField(event, { name: 'attendanceSessions', value: [next] });
  };
  change('timeIn', 'timeInOpen', '20:13'); change('timeIn', 'onTimeDeadline', '20:15');
  change('timeOut', 'timeOutOpen', '20:20'); change('timeOut', 'timeOutClose', '20:25');
  assert.equal(attendanceSetupIssue(event), '');
  const [saved] = normalizeSessions(JSON.parse(JSON.stringify(event.attendanceSessions)));
  assert.equal(validateSessions([saved], new Date('2026-11-08T20:13:00+08:00'), new Date('2026-11-08T20:20:00+08:00')), null);
  for (const clock of ['20:13:01', '20:14:00', '20:15:59']) {
    assert.equal(classify({ session: saved, timeInAt: new Date(`2026-11-08T${clock}+08:00`), timeOutAt: new Date('2026-11-08T20:22:00+08:00') }).hours, 0);
  }
  const retimed = applyEventField(event, { name: 'time', value: '20:14' });
  assert.equal(retimed.attendanceSessions[0].onTimeDeadline, event.attendanceSessions[0].onTimeDeadline);
  assert.match(attendanceSetupIssue({ ...event, endTime: '20:12' }), /End time must be after Start time/);
  assert.match(attendanceSetupIssue({ ...event, attendanceSessions: [{ ...saved, timeOutOpen: saved.onTimeDeadline }] }), /overlaps/);
  assert.match(attendanceSetupIssue({ ...event, attendanceSessions: [{ ...saved, timeOutClose: saved.timeOutOpen }] }), /closes before/);
  const { default: EventAttendanceSchedule } = await server.ssrLoadModule('/src/components/shared/EventAttendanceSchedule.jsx');
  const schedule = renderToStaticMarkup(React.createElement(EventAttendanceSchedule, { event }));
  assert.match(schedule, /8:13 PM – 8:15 PM/);
  assert.doesNotMatch(schedule, /8:19/);
  const { default: Guide } = await server.ssrLoadModule('/src/components/shared/AttendanceScheduleGuide.jsx');
  const guide = renderToStaticMarkup(React.createElement(Guide, { issue: 'Time In overlaps Time Out.', onClose() {} }));
  assert.match(guide, /Check the attendance schedule/);
  assert.match(guide, /Back to the schedule/);
  console.log('Arrival-window UI → API → penalty regression and schedule guidance passed.');
} finally { await server.close(); }
