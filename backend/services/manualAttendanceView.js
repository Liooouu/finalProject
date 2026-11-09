// A pending request is not confirmed attendance. These projections never alter
// stored penalties; an automatic absence stays provisional until review.
const key = (student, event, session) => `${String(student?._id || student)}:${String(event?._id || event)}:${String(session || "")}`;
const plain = value => value?.toObject ? value.toObject() : { ...value };

function projectManualAttendance(records, requests, { studentId, includeUnrecorded = true } = {}) {
  const pending = new Map();
  const pendingActions = new Map();
  for (const value of requests || []) {
    if (value.status !== "pending") continue;
    const requestKey = key(value.student || studentId, value.event, value.session);
    if (!pendingActions.has(requestKey)) pendingActions.set(requestKey, new Set());
    pendingActions.get(requestKey).add(value.action || "time_in");
    if (!pending.has(requestKey) || value.action === "time_in") pending.set(requestKey, value);
  }
  const seen = new Set();
  const result = (records || []).map(value => {
    const record = plain(value);
    const recordKey = key(record.student || studentId, record.event, record.session);
    seen.add(recordKey);
    const request = pending.get(recordKey);
    if (!request) return record;
    const pendingExit = !!record.session && pendingActions.get(recordKey).has("time_out") && record.completionStatus === "incomplete";
    const provisionalExitHours = pendingExit ? Math.min(2, record.communityServiceHours || 0) : 0;
    const automaticAbsence = record.status === "absent" && record.method === "auto";
    return {
      ...record,
      manualReviewPending: true,
      pendingManualActions: [...pendingActions.get(recordKey)],
      manualReviewProvisional: automaticAbsence || pendingExit,
      manualAttendanceRequest: requestInfo(request),
      ...(pendingExit ? { completionStatus: "pending", provisionalHours: provisionalExitHours, communityServiceHours: Math.max(0, (record.communityServiceHours || 0) - provisionalExitHours) } : {}),
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
      _id: `manual-pending:${request._id}`, event: request.event, session: request.session || null, sessionName: request.sessionName,
      student: request.student || studentId, status: "pending", method: "manual",
      attendedAt: request.effectiveAt, createdAt: request.submittedAt,
      verifiedAt: null, communityServiceHours: 0, communityServiceLog: [],
      manualReviewPending: true, manualReviewProvisional: true, provisionalHours: 0,
      pendingManualActions: [...pendingActions.get(recordKey)],
      manualAttendanceRequest: requestInfo(request),
    });
  }
  return result;
}

function requestInfo(request) {
  return {
    _id: request._id, session: request.session || null, sessionName: request.sessionName, action: request.action || "time_in", status: request.status, effectiveAt: request.effectiveAt,
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
      from: "manualattendancerequests", let: { eventId: "$event", studentId: "$student", recordStatus: "$status", recordMethod: "$method", recordCompletion: "$completionStatus", sessionId: { $ifNull: ["$session", null] } },
      pipeline: [{ $match: { status: "pending", $expr: { $and: [
        { $eq: ["$event", "$$eventId"] }, { $eq: ["$student", "$$studentId"] }, { $eq: [{ $ifNull: ["$session", null] }, "$$sessionId"] },
        { $or: [{ $and: [{ $eq: ["$$recordStatus", "absent"] }, { $eq: ["$$recordMethod", "auto"] }] }, { $and: [{ $eq: ["$$recordCompletion", "incomplete"] }, { $eq: ["$action", "time_out"] }] }] },
      ] } } }, { $limit: 1 }, { $project: { _id: 1 } }], as: "_pendingManualReview",
    } },
    { $set: { status: { $cond: [{ $and: [{ $eq: ["$status", "absent"] }, { $gt: [{ $size: "$_pendingManualReview" }, 0] }] }, "pending", "$status"] }, completionStatus: { $cond: [{ $and: [{ $eq: ["$completionStatus", "incomplete"] }, { $gt: [{ $size: "$_pendingManualReview" }, 0] }] }, "pending", "$completionStatus"] } } },
    { $unset: "_pendingManualReview" },
  ];
}
module.exports.manualPendingStatusStages = manualPendingStatusStages;
