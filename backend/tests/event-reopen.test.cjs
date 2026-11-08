const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lifecycle = require('../services/eventLifecycle');
const at = (day, clock) => new Date(`2026-11-${String(day).padStart(2, '0')}T${clock}+08:00`);
const event = changes => ({ _id: 'multi', __v: 0, title: 'CCIT multi-day', status: 'finished', manualOverride: false,
  date: '2026-11-09', time: '09:00', endDate: '2026-11-09', endTime: '17:00',
  attendanceStartTime: '07:00', attendanceEndTime: '09:00',
  attendanceSessions: [9, 10].map(day => ({ activityEnd: at(day, '17:00:00'), timeOutClose: at(day, '18:00:00') })),
  ...changes });

// Execute the actual scheduled status pass without starting the server, connecting
// to MongoDB, sending notifications, or changing any user's attendance.
async function runStatusPass(records, now, race) {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = source.indexOf('const toFinish = await Event.find(');
  const end = source.indexOf('\n      } catch (err) {', start);
  assert.ok(start > 0 && end > start);
  let changed = 0;
  const matches = (e, f) => (f._id === undefined || e._id === f._id)
    && (f.status === undefined || (typeof f.status === 'string' ? e.status === f.status : !f.status.$nin.includes(e.status)))
    && (!f.manualOverride || e.manualOverride !== true)
    && (!f['attendanceSessions.1'] || e.attendanceSessions?.length > 1)
    && (f.__v === undefined || e.__v === f.__v);
  const Event = {
    find: async filter => records.filter(e => matches(e, filter)).map(e => structuredClone(e)),
    findByIdAndUpdate: async (id, update) => { const e = records.find(e => e._id === id); Object.assign(e, update); return e; },
    findOneAndUpdate: async (filter, update) => {
      if (race) { race(records); race = null; }
      const e = records.find(e => matches(e, filter));
      if (!e) return null;
      Object.assign(e, update.$set || update); return e;
    },
  };
  await vm.runInNewContext(`(async () => { ${source.slice(start, end)} })()`, {
    ...lifecycle, Event, now, console: { log() {}, error() {} },
    require: name => {
      assert.equal(name, './services/recordUpdates');
      return { publishRecordChange: () => { changed++; } };
    },
  });
  return changed;
}

test('a finished multi-day event reopens even when there are no open events to finish', async () => {
  const e = event();
  await runStatusPass([e], at(10, '07:30:00'));
  assert.equal(e.status, 'live'); assert.equal(e.autoFinishedAt, null);
});

test('last session departure grace is included even when activityEnd is earlier', () => {
  const e = event({ status: 'live' });
  assert.equal(+lifecycle.eventLastCheckInAt(e), +at(10, '18:00:00'));
  assert.equal(lifecycle.shouldAutoFinish(e, at(10, '17:30:00')), false);
  assert.equal(lifecycle.shouldAutoFinish(e, at(10, '18:00:00')), false, 'Time Out accepts the closing instant');
  assert.equal(lifecycle.shouldAutoFinish(e, new Date(+at(10, '18:00:00') + 1)), true);
});

test('Day 1 closing never finishes the whole event while Day 2 remains scheduled', async () => {
  const e = event({ status: 'live' });
  await runStatusPass([e], at(9, '18:01:00'));
  assert.equal(e.status, 'live');
});

test('recovery retains the last session Time Out window and finishes only after it closes', async () => {
  const e = event();
  await runStatusPass([e], at(10, '17:30:00')); assert.equal(e.status, 'live');
  await runStatusPass([e], at(10, '18:00:00')); assert.equal(e.status, 'live');
  await runStatusPass([e], new Date(+at(10, '18:00:00') + 1)); assert.equal(e.status, 'finished');
});

test('manual closure, manual overrides, ended sessions and legacy events stay untouched', async () => {
  const cases = [event({ status: 'closed' }), event({ manualOverride: true }),
    event({ attendanceSessions: [] }), event({ attendanceSessions: [event().attendanceSessions[0]] })];
  for (const e of cases) {
    const before = structuredClone(e); await runStatusPass([e], at(10, '07:30:00')); assert.deepEqual(e, before);
  }
  const ended = event(); await runStatusPass([ended], at(11, '07:30:00')); assert.equal(ended.status, 'finished');
});

test('a concurrent manual close cannot be overwritten by automated recovery', async () => {
  const e = event();
  await runStatusPass([e], at(10, '07:30:00'), records => { records[0].status = 'closed'; records[0].manualOverride = true; });
  assert.equal(e.status, 'closed'); assert.equal(e.manualOverride, true);
});

test('a concurrent schedule edit is not overwritten by a stale recovery snapshot', async () => {
  const e = event();
  await runStatusPass([e], at(10, '07:30:00'), records => { records[0].__v++; records[0].attendanceSessions = []; });
  assert.equal(e.status, 'finished');
});

test('recovery is repeatable and publishes only one change without touching attendance fields', async () => {
  const e = event({ attendanceNote: 'retain history', sessionScheduleLockedAt: at(9, '07:00:00') });
  const sessions = structuredClone(e.attendanceSessions);
  const first = await runStatusPass([e], at(10, '07:30:00'));
  const second = await runStatusPass([e], at(10, '07:30:00'));
  assert.equal(first, 1); assert.equal(second, 0);
  assert.deepEqual(e.attendanceSessions, sessions); assert.equal(e.attendanceNote, 'retain history');
});
