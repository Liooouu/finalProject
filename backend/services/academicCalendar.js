const config = require('../config/academicCalendar.json');
const OFFSET = 8 * 60 * 60 * 1000;
const instant = (year, month, day) => new Date(Date.UTC(year, month - 1, day) - OFFSET);
function schoolYearStart(now = new Date(), calendar = config) {
  const year = new Date(now.getTime() + OFFSET).getUTCFullYear();
  return now >= instant(year, calendar.schoolYearStartMonth, calendar.schoolYearStartDay) ? year : year - 1;
}
function periodFor(startYear, calendar = config) {
  const start = instant(startYear, calendar.schoolYearStartMonth, calendar.schoolYearStartDay);
  const end = new Date(instant(startYear + 1, calendar.schoolYearStartMonth, calendar.schoolYearStartDay).getTime() - 1);
  const semesters = calendar.semesters.map(term => {
    const yearFor = (month, day) => startYear + (month < calendar.schoolYearStartMonth || (month === calendar.schoolYearStartMonth && day < calendar.schoolYearStartDay) ? 1 : 0);
    const firstYear = yearFor(term.startMonth, term.startDay);
    let lastYear = yearFor(term.endMonth, term.endDay);
    let last = instant(lastYear, term.endMonth, term.endDay);
    const first = instant(firstYear, term.startMonth, term.startDay);
    if (last < first) last = instant(++lastYear, term.endMonth, term.endDay);
    return { id: term.id, label: term.label, start: first, end: new Date(last.getTime() + 86400000 - 1) };
  });
  return { startYear, label: `${startYear}–${startYear + 1}`, start, end, semesters };
}
function calendarView(now = new Date(), calendar = config) {
  const current = periodFor(schoolYearStart(now, calendar), calendar);
  return { confirmed: calendar.confirmed === true, current, currentSemester: current.semesters.find(term => now >= term.start && now <= term.end) || null,
    years: Array.from({ length: 6 }, (_, i) => periodFor(current.startYear - 4 + i, calendar)) };
}
function promotionPlan(student, targetYear) {
  if (student.enrollmentStatus === "graduated") return null;
  const anchor = student.academicYearStart;
  if (!Number.isInteger(anchor)) return { yearLevel: student.yearLevel, academicYearStart: targetYear, history: [], baseline: true };
  if (targetYear <= anchor) return null;
  const history = [];
  for (let year = anchor; year < Math.min(targetYear, anchor + 5 - student.yearLevel); year++) history.push({ schoolYearStart: year, yearLevel: Math.min(4, student.yearLevel + year - anchor), section: student.section, program: student.program });
  return { yearLevel: Math.min(4, student.yearLevel + targetYear - anchor), enrollmentStatus: student.yearLevel + targetYear - anchor > 4 ? "graduated" : "active", academicYearStart: targetYear, history, baseline: false };
}
module.exports = { config, schoolYearStart, periodFor, calendarView, promotionPlan };
