const { test } = require("node:test");
const assert = require("node:assert/strict");
const { schoolYearStart, calendarView } = require("../services/academicCalendar");
const { excuseWindow } = require("../services/excuseWindow");

test("school-year dates use the Manila boundary, not January", () => {
  assert.equal(schoolYearStart(new Date("2027-01-01T00:00:00Z")), 2026);
  assert.equal(schoolYearStart(new Date("2027-07-31T15:59:59Z")), 2026);
  assert.equal(schoolYearStart(new Date("2027-07-31T16:00:00Z")), 2027);
});
test("semester filters retain their inclusive boundaries without advancing students", () => {
  assert.equal(calendarView(new Date("2026-12-31T15:59:59.999Z")).currentSemester.id, "first");
  assert.equal(calendarView(new Date("2026-12-31T16:00:00Z")).currentSemester.id, "second");
  assert.equal(calendarView(new Date("2027-06-15T00:00:00Z")).currentSemester, null);
  assert.equal(calendarView(new Date("2026-10-28T00:00:00Z")).confirmed, false);
});
test("excuses remain eligible through exactly seven days after event end", () => {
  const event = { date: "2026-10-20", endTime: "20:00" };
  assert.equal(excuseWindow(event, new Date("2026-10-20T11:59:59Z")).allowed, false);
  assert.equal(excuseWindow(event, new Date("2026-10-27T12:00:00Z")).allowed, true);
  assert.equal(excuseWindow(event, new Date("2026-10-27T12:00:00.001Z")).allowed, false);
  assert.equal(excuseWindow({ ...event, endDate: "2026-10-22" }, new Date("2026-10-29T12:00:00Z")).allowed, true);
});
