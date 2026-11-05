const { parseClock, eventStartsAt, eventEndAt } = require("./eventLifecycle");

function dateIssue(value, label) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (value == null || value === "" || !Number.isFinite(parsed.getTime())) return `A valid ${label.toLowerCase()} is required`;
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const calendarDay = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) {
    return `A valid ${label.toLowerCase()} is required`;
  }
  if (Number(day.slice(0, 4)) < 2026) return `${label} must be January 1, 2026 or later. TrackED events start from 2026.`;
  return "";
}
function validateSchedule(schedule) {
  const startIssue = dateIssue(schedule.date, "Event date");
  if (startIssue) return startIssue;
  if (schedule.endDate) {
    const endIssue = dateIssue(schedule.endDate, "End date");
    if (endIssue) return endIssue;
  }
  for (const [field, label] of [["time", "Start time"], ["endTime", "End time"], ["attendanceStartTime", "Attendance window start"], ["attendanceEndTime", "Attendance window end"]]) {
    if (schedule[field] && !parseClock(schedule[field])) return `${label} must be in HH:mm format`;
  }
  const startsAt = eventStartsAt(schedule), endsAt = eventEndAt(schedule);
  if (!startsAt || !endsAt) return "A valid event schedule is required";
  if (endsAt <= startsAt) return "The event must end after it starts";
  // Overnight attendance windows are resolved by eventLifecycle in Manila time.
  return null;
}
module.exports = { validateSchedule };
