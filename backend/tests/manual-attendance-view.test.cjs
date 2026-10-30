const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectManualAttendance } = require('../services/manualAttendanceView');
const student = 'student-a', event = 'event-a';
const request = { _id: 'request-a', student, event: { _id: event, title: 'CCIT event' }, status: 'pending', effectiveAt: new Date('2026-10-30T00:20:00Z'), submittedAt: new Date('2026-10-30T00:20:00Z'), proposedStatus: 'present', proposedHours: 0 };

test('automatic absence is provisional while pending without mutating stored penalty or audit history', () => {
  const source = { _id: 'attendance-a', student, event, status: 'absent', method: 'auto', communityServiceHours: 8, communityServiceLog: [{ action: 'penalty', hours: 8 }] };
  const [row] = projectManualAttendance([source], [request]);
  assert.equal(row.status, 'pending'); assert.equal(row.communityServiceHours, 0); assert.equal(row.provisionalHours, 8);
  assert.equal(row.manualReviewProvisional, true); assert.equal(row.manualAttendanceRequest.effectiveAt, request.effectiveAt);
  assert.equal(source.status, 'absent'); assert.equal(source.communityServiceHours, 8); assert.deepEqual(row.communityServiceLog, source.communityServiceLog);
});
test('pending request before automatic absence appears without claiming confirmed attendance', () => {
  const [row] = projectManualAttendance([], [request], { studentId: student });
  assert.equal(row.status, 'pending'); assert.equal(row.communityServiceHours, 0); assert.equal(row.verifiedAt, null);
  assert.equal(row.event.title, 'CCIT event'); assert.equal(row.attendedAt, request.effectiveAt);
});
test('pending correction does not erase confirmed face attendance or previously decided manual penalties', () => {
  for (const source of [{ student, event, status: 'present', method: 'face', communityServiceHours: 0 }, { student, event, status: 'late', method: 'manual', communityServiceHours: 4 }]) {
    const [row] = projectManualAttendance([source], [request]);
    assert.equal(row.status, source.status); assert.equal(row.communityServiceHours, source.communityServiceHours);
    assert.equal(row.manualReviewPending, true); assert.equal(row.manualReviewProvisional, false);
  }
});
test('rejected or approved requests do not hold an absence penalty', () => {
  const source = { student, event, status: 'absent', method: 'auto', communityServiceHours: 8 };
  for (const status of ['approved', 'rejected']) {
    assert.deepEqual(projectManualAttendance([source], [{ ...request, status }]), [source]);
  }
});
test('projection scopes by student and event rather than only event', () => {
  const source = { student: 'student-b', event, status: 'absent', method: 'auto', communityServiceHours: 8 };
  const rows = projectManualAttendance([source], [request]);
  assert.equal(rows.length, 2); assert.equal(rows[0].communityServiceHours, 8); assert.equal(rows[1].student, student);
  assert.equal(projectManualAttendance([source], [request], { includeUnrecorded: false }).length, 1);
});
