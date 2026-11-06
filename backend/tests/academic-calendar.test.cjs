const { test } = require("node:test");
const assert = require("node:assert/strict");
const { view } = require("../services/academicPeriods");
const { excuseWindow } = require("../services/excuseWindow");
test("unconfigured terms contain no guessed current year or dates",()=>{const data=view(null);assert.equal(data.current,null);assert.equal(data.configured,false);assert.deepEqual(data.years,[]);});
test("manual semesters have labels without invented calendar boundaries",()=>{const data=view({academicPeriods:{years:[2026],active:{startYear:2026,semester:"second"}}});assert.equal(data.currentSemester.id,"second");assert.equal(data.current.startYear,2026);for(const term of data.current.semesters){assert.equal(term.start,undefined);assert.equal(term.end,undefined);}});

test("excuses remain eligible through exactly seven days after event end", () => {
  const event = { date: "2026-10-20", endTime: "20:00" };
  assert.equal(excuseWindow(event, new Date("2026-10-20T11:59:59Z")).allowed, false);
  assert.equal(excuseWindow(event, new Date("2026-10-27T12:00:00Z")).allowed, true);
  assert.equal(excuseWindow(event, new Date("2026-10-27T12:00:00.001Z")).allowed, false);
  assert.equal(excuseWindow({ ...event, endDate: "2026-10-22" }, new Date("2026-10-29T12:00:00Z")).allowed, true);
});
