// A pending request is not confirmed attendance. These projections never alter
// stored penalties; an automatic absence stays provisional until review.
const key = (student, event) => `${String(student?._id || student)}:${String(event?._id || event)}`;
const plain = value => value?.toObject ? value.toObject() : { ...value };

function projectManualAttendance(records, requests, { studentId, includeUnrecorded = true } = {}) {
  const pending = new Map();
  for (const value of requests || []) {
    if (value.status !== "pending") continue;
    pending.set(key(value.student || studentId, value.event), value);
  }
  const seen = new Set();
  const result = (records || []).map(value => {
    const record = plain(value);
    const recordKey = key(record.student || studentId, record.event);
    seen.add(recordKey);
    const request = pending.get(recordKey);
    if (!request) return record;
    const automaticAbsence = record.status === "absent" && record.method === "auto";
    return {
      ...record,
      manualReviewPending: true,
      manualReviewProvisional: automaticAbsence,
      manualAttendanceRequest: requestInfo(request),
      ...(automaticAbsence ? {
        status: "pending", provisionalStatus: record.status,
        provisionalHours: record.communityServiceHours || 0,
        communityServiceHours: 0,
      } : {}),
    };
  });
  if (includeUnrecorded) for (const [recordKey, request] of pending) {
    if (seen.has(recordKey)) continue;
    result.push({
      _id: `manual-pending:${request._id}`, event: request.event,
      student: request.student || studentId, status: "pending", method: "manual",
      attendedAt: request.effectiveAt, createdAt: request.submittedAt,
      verifiedAt: null, communityServiceHours: 0, communityServiceLog: [],
      manualReviewPending: true, manualReviewProvisional: true, provisionalHours: 0,
      manualAttendanceRequest: requestInfo(request),
    });
  }
  return result;
}

function requestInfo(request) {
  return {
    _id: request._id, status: request.status, effectiveAt: request.effectiveAt,
    submittedAt: request.submittedAt, proposedStatus: request.proposedStatus,
    proposedHours: request.proposedHours, requestedBy: request.requestedBy,
  };
}

module.exports = { projectManualAttendance };

// Apply the same provisional status in aggregate report totals and charts.
// The lookup uses the request's event/student index; no penalty is overwritten.
function manualPendingStatusStages() {
  return [
    { $lookup: {
      from: "manualattendancerequests", let: { eventId: "$event", studentId: "$student", recordStatus: "$status", recordMethod: "$method" },
      pipeline: [{ $match: { status: "pending", $expr: { $and: [
        { $eq: ["$event", "$$eventId"] }, { $eq: ["$student", "$$studentId"] },
        { $eq: ["$$recordStatus", "absent"] }, { $eq: ["$$recordMethod", "auto"] },
      ] } } }, { $limit: 1 }, { $project: { _id: 1 } }], as: "_pendingManualReview",
    } },
    { $set: { status: { $cond: [{ $gt: [{ $size: "$_pendingManualReview" }, 0] }, "pending", "$status"] } } },
    { $unset: "_pendingManualReview" },
  ];
}
module.exports.manualPendingStatusStages = manualPendingStatusStages;
