const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classify, diff, HOURS } = require("../services/penaltyCalc");

function mkSession(overrides = {}) {
  const now = new Date("2026-04-10T08:00:00.000Z"); // placeholder
  const base = {
    timeInOpen: new Date("2026-04-10T00:00:00.000Z"),
    onTimeDeadline: new Date("2026-04-10T01:00:00.000Z"), // 09:00 Manila? keep UTC for tests
    timeInCutoff: new Date("2026-04-10T02:00:00.000Z"),
    timeOutOpen: new Date("2026-04-10T03:00:00.000Z"),
    timeOutClose: new Date("2026-04-10T05:00:00.000Z"),
  };
  return { ...base, ...overrides };
}

test("on-time + completed = 0 hours", () => {
  const s = mkSession();
  const r = classify({ timeInAt: new Date("2026-04-10T00:30:00.000Z"), timeOutAt: new Date("2026-04-10T03:30:00.000Z"), session: s, now: new Date("2026-04-10T04:00:00.000Z") });
  assert.equal(r.arrivalStatus, "on_time");
  assert.equal(r.completionStatus, "completed");
  assert.equal(r.hours, 0);
});

test("late + completed = 4 hours", () => {
  const s = mkSession();
  const r = classify({ timeInAt: new Date("2026-04-10T01:30:00.000Z"), timeOutAt: new Date("2026-04-10T03:30:00.000Z"), session: s, now: new Date("2026-04-10T04:00:00.000Z") });
  assert.equal(r.arrivalStatus, "late");
  assert.equal(r.completionStatus, "completed");
  assert.equal(r.hours, 4);
});

test("on-time + incomplete (after deadline) = 2 hours", () => {
  const s = mkSession();
  const r = classify({ timeInAt: new Date("2026-04-10T00:30:00.000Z"), timeOutAt: null, session: s, now: new Date("2026-04-10T06:00:00.000Z") });
  assert.equal(r.arrivalStatus, "on_time");
  assert.equal(r.completionStatus, "incomplete");
  assert.equal(r.hours, 2);
});

test("late + incomplete (after deadline) = 6 hours", () => {
  const s = mkSession();
  const r = classify({ timeInAt: new Date("2026-04-10T01:30:00.000Z"), timeOutAt: null, session: s, now: new Date("2026-04-10T06:00:00.000Z") });
  assert.equal(r.arrivalStatus, "late");
  assert.equal(r.completionStatus, "incomplete");
  assert.equal(r.hours, 6);
});

test("absent = 8 hours total, no incomplete add-on", () => {
  const s = mkSession();
  const r = classify({ timeInAt: null, timeOutAt: null, session: s, now: new Date("2026-04-10T06:00:00.000Z") });
  assert.equal(r.completionStatus, "absent");
  assert.equal(r.hours, 8);
});

test("no incomplete penalty before exit deadline (late carries 4 only)", () => {
  const s = mkSession();
  const r = classify({ timeInAt: new Date("2026-04-10T01:30:00.000Z"), timeOutAt: null, session: s, now: new Date("2026-04-10T04:00:00.000Z") });
  assert.equal(r.completionStatus, "pending");
  assert.equal(r.hours, 4);
  assert.equal(r.state, "awaiting_timeout");
});

test("time out alone does not establish attendance", () => {
  const s = mkSession();
  const r = classify({ timeInAt: null, timeOutAt: new Date("2026-04-10T03:30:00.000Z"), session: s, now: new Date("2026-04-10T04:00:00.000Z") });
  assert.equal(r.completionStatus, "absent");
  assert.equal(r.hours, 8);
});

test("still pending before cutoff", () => {
  const s = mkSession();
  const r = classify({ timeInAt: null, timeOutAt: null, session: s, now: new Date("2026-04-10T01:30:00.000Z") });
  assert.equal(r.completionStatus, "pending");
  assert.equal(r.hours, 0);
});

test("diff computes delta", () => {
  assert.equal(diff(0, 4), 4);
  assert.equal(diff(4, 6), 2);
  assert.equal(diff(8, 0), -8);
});