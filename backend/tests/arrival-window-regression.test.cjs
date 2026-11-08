const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSessions, validateSessions, sessionConfig } = require('../services/sessionSchedule');
const { classify } = require('../services/penaltyCalc');
const { modeFor } = require('../services/sessionAttendance');
const at = clock => new Date(`2026-11-08T${clock}+08:00`);
const draft = () => ({ name: 'Event attendance', timeInPolicy: 'window_then_late',
  timeInOpen: at('20:13:00'), onTimeDeadline: at('20:15:00'), timeInCutoff: at('20:15:00'),
  timeOutOpen: at('20:20:00'), timeOutClose: at('20:25:00') });

test('8:13–8:15 PM is on time throughout the displayed range, not late after event start', () => {
  const [session] = normalizeSessions([draft()]);
  assert.equal(validateSessions([session], at('20:13:00'), at('20:20:00')), null);
  assert.equal(+session.onTimeDeadline, +at('20:15:59.999'));
  assert.equal(+session.timeInCutoff, +at('20:19:59.999'));
  for (const clock of ['20:13:00', '20:13:00.001', '20:14:30', '20:15:00', '20:15:59.999']) {
    const result = classify({ session, timeInAt: at(clock), timeOutAt: at('20:22:00') });
    assert.equal(result.arrivalStatus, 'on_time', clock);
    assert.equal(result.hours, 0, clock);
  }
  for (const clock of ['20:16:00', '20:19:59.999']) {
    assert.equal(modeFor({ status: 'live' }, session, at(clock)), 'time_in');
    const result = classify({ session, timeInAt: at(clock), timeOutAt: at('20:22:00') });
    assert.equal(result.arrivalStatus, 'late'); assert.equal(result.hours, 4);
  }
  assert.equal(modeFor({ status: 'finished' }, session, at('20:20:00')), 'time_out');
  assert.equal(modeFor({ status: 'closed' }, session, at('20:19:00')), 'closed');
  assert.equal(classify({ session, timeInAt: at('20:20:00'), now: at('20:22:00') }).arrivalStatus, null, 'cannot Time In once Time Out opens');
});

test('late entry is available until departure opens even after automatic event finish', () => {
  const [session] = normalizeSessions([{ ...draft(), timeOutOpen: at('20:22:00') }]);
  assert.equal(validateSessions([session], at('20:13:00'), at('20:20:00')), null);
  assert.equal(modeFor({ status: 'finished' }, session, at('20:21:59.999')), 'time_in');
  assert.equal(modeFor({ status: 'finished' }, session, at('20:22:00')), 'time_out');
});

test('0/4/2/6/8 penalties and delayed absence still use the saved capture times', () => {
  const [session] = normalizeSessions([draft()]);
  const after = at('20:26:00');
  assert.equal(classify({ session, timeInAt: at('20:14:00'), now: after }).hours, 2);
  assert.equal(classify({ session, timeInAt: at('20:17:00'), now: after }).hours, 6);
  assert.equal(classify({ session, now: at('20:25:00') }).hours, 0);
  assert.equal(classify({ session, now: after }).hours, 8);
});

test('new rules reject overlap and reversed arrival limits without rewriting old schedules', () => {
  for (const change of [{ onTimeDeadline: at('20:12:00') }, { onTimeDeadline: at('20:20:00') }, { timeOutClose: at('20:19:00') }]) {
    assert.ok(validateSessions(normalizeSessions([{ ...draft(), ...change }]), at('20:13:00'), at('20:20:00')));
  }
  const old = { ...draft(), timeInPolicy: undefined, onTimeDeadline: at('20:13:00') };
  const [preserved] = normalizeSessions([old]);
  assert.equal(+preserved.onTimeDeadline, +old.onTimeDeadline);
  assert.equal(+preserved.timeInCutoff, +old.timeInCutoff);
  assert.equal(sessionConfig([preserved]), sessionConfig([old]));
  assert.notEqual(sessionConfig([preserved]), sessionConfig(normalizeSessions([draft()])));
});
