const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSessions, validateSessions, sessionConfig } = require('../services/sessionSchedule');
const at = (day, clock) => `2026-11-${day}T${clock}:00+08:00`;
const period = day => ({ name: `Day ${day}`, timeInPolicy: 'window_then_late',
  timeInOpen: at(day, '07:00'), onTimeDeadline: at(day, '09:00'), timeInCutoff: at(day, '16:59'),
  timeOutOpen: at(day, '17:00'), timeOutClose: at(day, '18:00') });
const extra = () => ({ ...period('09'), activityStart: at('09', '09:00'), activityEnd: at('09', '17:00') });
const check = row => validateSessions(normalizeSessions([period('08'), row]), new Date(at('08', '09:00')), new Date(at('08', '17:00')));

test('additional days use their own schedule instead of the first event day', () => {
  assert.equal(check(extra()), null);
  assert.match(check({ ...extra(), onTimeDeadline: at('09', '09:01') }), /Day 09: Time In must end/);
  assert.match(check({ ...extra(), timeOutOpen: at('09', '16:59') }), /Day 09: Time Out cannot open/);
});

test('new additional activities require valid explicit start/end timestamps', () => {
  assert.throws(() => normalizeSessions([period('08'), period('09')]), /start and end schedule/);
  assert.throws(() => normalizeSessions([period('08'), { ...extra(), activityStart: '2026-11-09T09:00' }]), /time zone/);
  assert.match(check({ ...extra(), activityEnd: at('09', '08:00') }), /End time must be after/);
  assert.match(check({ ...extra(), timeOutClose: at('09', '16:00') }), /close must be after/);
});

test('activity schedule fields persist and participate in existing schedule locks', () => {
  const rows = normalizeSessions([period('08'), extra()]);
  assert.equal(rows[1].activityStart.toISOString(), '2026-11-09T01:00:00.000Z');
  assert.equal(rows[1].activityEnd.toISOString(), '2026-11-09T09:00:00.000Z');
  assert.notEqual(sessionConfig(rows), sessionConfig([rows[0], { ...rows[1], activityEnd: new Date(at('09', '16:00')) }]));
  const legacy = { ...period('08'), timeInPolicy: undefined };
  assert.equal(sessionConfig(normalizeSessions([legacy])), sessionConfig([legacy]));
});
