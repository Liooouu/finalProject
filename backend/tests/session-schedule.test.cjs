const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateSessions, validateSession, defaultSession } = require("../services/sessionSchedule");

test("valid single session passes", () => {
  const s = [{
    name: "Day 1",
    timeInOpen: "2026-04-10T00:00:00.000Z",
    onTimeDeadline: "2026-04-10T01:00:00.000Z",
    timeInCutoff: "2026-04-10T02:00:00.000Z",
    timeOutOpen: "2026-04-10T03:00:00.000Z",
    timeOutClose: "2026-04-10T05:00:00.000Z",
  }];
  assert.equal(validateSessions(s), null);
});

test("overlapping entry/exit rejected", () => {
  const s = [{
    name: "Day 1",
    timeInOpen: "2026-04-10T00:00:00.000Z",
    onTimeDeadline: "2026-04-10T01:00:00.000Z",
    timeInCutoff: "2026-04-10T04:00:00.000Z", // overlaps timeOutOpen
    timeOutOpen: "2026-04-10T03:00:00.000Z",
    timeOutClose: "2026-04-10T05:00:00.000Z",
  }];
  assert.ok(validateSessions(s));
});

test("duplicate session names rejected", () => {
  const s = [
    { name: "Day 1", timeInOpen: "2026-04-10T00:00:00.000Z", onTimeDeadline: "2026-04-10T01:00:00.000Z", timeInCutoff: "2026-04-10T02:00:00.000Z", timeOutOpen: "2026-04-10T03:00:00.000Z", timeOutClose: "2026-04-10T05:00:00.000Z" },
    { name: "Day 1", timeInOpen: "2026-04-11T00:00:00.000Z", onTimeDeadline: "2026-04-11T01:00:00.000Z", timeInCutoff: "2026-04-11T02:00:00.000Z", timeOutOpen: "2026-04-11T03:00:00.000Z", timeOutClose: "2026-04-11T05:00:00.000Z" },
  ];
  assert.ok(validateSessions(s));
});

test("empty sessions allowed (legacy)", () => {
  assert.equal(validateSessions([]), null);
});

test("defaultSession produces valid session", () => {
  const e = { date: "2026-04-10", time: "08:00", endDate: "2026-04-10", endTime: "17:00", attendanceStartTime: "07:30", attendanceEndTime: "08:15" };
  const s = defaultSession(e);
  assert.ok(s.name);
  assert.ok(s.timeInOpen instanceof Date);
  assert.equal(validateSession(s, 0, null, null), null);
});
test('departures after the event end are valid, while late event entry is not', () => {
  const at = clock => new Date(`2026-11-08T${clock}:00+08:00`);
  const row = { name: 'Event attendance', timeInOpen: at('10:00'), onTimeDeadline: at('11:00'), timeInCutoff: at('11:00'), timeOutOpen: at('17:01'), timeOutClose: at('18:00') };
  assert.equal(validateSession(row, 0, at('10:00'), at('17:00')), null);
  assert.match(validateSession({ ...row, timeInCutoff: at('17:30'), timeOutOpen: at('17:45') }, 0, at('10:00'), at('17:00')), /Time In must close/);
  const { modeFor } = require('../services/sessionAttendance');
  assert.equal(modeFor({ status: 'finished' }, row, at('17:30')), 'time_out');
  assert.equal(modeFor({ status: 'finished' }, row, at('18:01')), 'closed');
  assert.equal(modeFor({ status: 'closed' }, row, at('17:30')), 'closed');
});

test('arrival before event start and departure afterward work together', () => {
  const at = clock => new Date(`2026-11-08T${clock}:00+08:00`);
  const row = { name: 'Event attendance', timeInOpen: at('07:14'), onTimeDeadline: at('08:14'), timeInCutoff: at('08:14'), timeOutOpen: at('09:15'), timeOutClose: at('10:00') };
  assert.equal(validateSession(row, 0, at('08:14'), at('09:14')), null);
  const { modeFor } = require('../services/sessionAttendance');
  const { classify } = require('../services/penaltyCalc');
  assert.equal(modeFor({ status: 'upcoming' }, row, at('07:30')), 'time_in');
  assert.equal(modeFor({ status: 'upcoming' }, row, at('07:13')), 'closed');
  assert.equal(modeFor({ status: 'finished' }, row, at('09:30')), 'time_out');
  assert.equal(classify({ session: row, timeInAt: at('07:30'), timeOutAt: at('09:30'), now: at('10:01') }).hours, 0);
  assert.match(validateSession({ ...row, timeInOpen: new Date('2025-12-31T23:00:00+08:00') }, 0, at('08:14'), at('09:14')), /2026 or later/);
  assert.match(validateSession({ ...row, timeOutOpen: at('08:00') }, 0, at('08:14'), at('09:14')), /after Time In closes/);
});

test('Late after may equal Time In opens; an earlier deadline is explained clearly', () => {
  const row = { name: 'Event attendance', timeInOpen: '2026-11-08T00:00:00Z', onTimeDeadline: '2026-11-08T00:00:00Z', timeInCutoff: '2026-11-08T01:00:00Z', timeOutOpen: '2026-11-08T09:00:00Z', timeOutClose: '2026-11-08T10:00:00Z' };
  assert.equal(validateSession(row, 0), null);
  assert.match(validateSession({ ...row, onTimeDeadline: '2026-11-07T23:59:00Z' }, 0), /Late after cannot be earlier/);
});
