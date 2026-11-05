const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateSchedule } = require("../services/eventSchedule");
const valid = { date: "2026-01-01", time: "08:00", endTime: "12:00", attendanceStartTime: "07:30", attendanceEndTime: "08:15" };
test("event schedules start in 2026 and allow later years", () => {
  for (const date of ["2026-01-01", "2027-11-05", "2028-02-29"]) assert.equal(validateSchedule({ ...valid, date }), null);
  for (const date of ["2025-12-31", "1979-03-12"]) assert.match(validateSchedule({ ...valid, date }), /2026/);
});
test("invalid calendar dates and end dates cannot be saved", () => {
  for (const date of ["2026-02-30", "2026-02-29", "2026-13-01", "not-a-date", "", null]) assert.ok(validateSchedule({ ...valid, date }));
  assert.match(validateSchedule({ ...valid, endDate: "2025-12-31" }), /2026/);
  assert.match(validateSchedule({ ...valid, endDate: "2026-02-30" }), /valid/);
  assert.match(validateSchedule({ ...valid, date: "2026-11-05", endDate: "2026-11-04" }), /end after/);
});
test("stored dates, midnight Manila boundary, and overnight windows remain supported", () => {
  assert.equal(validateSchedule({ ...valid, date: new Date("2026-01-01T00:00:00Z") }), null);
  assert.equal(validateSchedule({ ...valid, time: "23:00", endDate: "2026-01-02", endTime: "02:00", attendanceStartTime: "23:00", attendanceEndTime: "01:00" }), null);
});
test("invalid clocks and non-positive event duration are rejected", () => {
  for (const field of ["time", "endTime", "attendanceStartTime", "attendanceEndTime"]) assert.match(validateSchedule({ ...valid, [field]: "99:99" }), /HH:mm/);
  assert.match(validateSchedule({ ...valid, endTime: "08:00" }), /end after/);
});
