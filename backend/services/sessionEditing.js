const Attendance = require('../models/Attendance');
const Request = require('../models/ManualAttendanceRequest');
const Station = require('../models/CheckInSession');
const DeletedAttendance = require('../models/DeletedAttendance');
const { sessionConfig } = require('./sessionSchedule');
const id = value => String(value?._id || value || '');

async function sessionEditLocks(event, now = new Date()) {
  if (!event.attendanceSessions?.length) return [];
  const filter = { event: event._id };
  const [records, requests, stations, removed] = await Promise.all([
    Attendance.find(filter).select('session').lean(),
    Request.find(filter).select('session').lean(),
    Station.find({ ...filter, closedAt: null, expiresAt: { $gt: now } }).select('session').lean(),
    DeletedAttendance.find(filter).select('session record.session').lean(),
  ]);
  const has = (rows, key) => rows.some(row => id(row.session || row.record?.session) === key);
  // Historical event-wide evidence with no session ID cannot be reassigned.
  const unscoped = [...records, ...requests, ...removed].some(row => !id(row.session || row.record?.session));
  return event.attendanceSessions.flatMap(row => {
    const key = id(row);
    const reason = unscoped || has(records, key) || has(removed, key) ? 'Attendance records already use this day.'
      : has(requests, key) ? 'An attendance request already uses this day.'
      : row.rosterLockedAt ? 'Attendance processing has already started for this day.'
      : has(stations, key) ? 'Close this day’s face station before editing its schedule.'
      : row.capturePreparedUntil && new Date(row.capturePreparedUntil) > now ? 'Attendance capture or an offline ticket is using this schedule.'
      : '';
    return reason ? [{ sessionId: key, reason }] : [];
  });
}

function lockedSessionChange(previous, next, locks) {
  const protectedIds = new Set(locks.map(row => row.sessionId));
  return (previous || []).find(row => protectedIds.has(id(row)) && (
    !next.some(value => id(value) === id(row)) || sessionConfig([row]) !== sessionConfig([next.find(value => id(value) === id(row))])
  ));
}

module.exports = { sessionEditLocks, lockedSessionChange };
