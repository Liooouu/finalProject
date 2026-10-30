const crypto = require("crypto");
const { isValidObjectId } = require("mongoose");
const { eventWindow, eventLastCheckInAt, isTerminal } = require("./eventLifecycle");

const idOf = value => String(value?._id || value || "");
const plain = value => value?.toObject ? value.toObject() : value;
const baseHours = status => status === "absent" ? 8 : status === "late" ? 4 : 0;
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function fingerprint(record) {
  if (!record) return null;
  return { id: idOf(record), status: record.status, method: record.method, hours: record.communityServiceHours || 0,
    updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
    attendedAt: record.attendedAt ? new Date(record.attendedAt).toISOString() : null };
}
function canReview(user, event, request) {
  if (!user || !event || !request || idOf(user) === idOf(request.requestedBy) || idOf(user) === idOf(request.student)) return false;
  return user.role === "admin" || (user.role === "organizer" && (event.manualAttendanceReviewers || []).some(value => idOf(value) === idOf(user)));
}
function buildProposal(event, payload, now = new Date()) {
  const mode = payload.mode || "checkin";
  if (!["checkin", "correction"].includes(mode)) fail(400, "Choose live check-in or an attendance correction");
  if (payload.identityChecked !== true) fail(400, "Confirm that you checked the student's identity and attendance evidence");
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (reason.length < 5 || reason.length > 1000) fail(400, "Give a reason between 5 and 1000 characters");
  const window = eventWindow(event), cutoff = eventLastCheckInAt(event);
  if (!window || !cutoff) fail(400, "This event has no valid attendance schedule");
  if (payload.requestedStatus && payload.requestedStatus !== "absent") fail(400, "Present or late is calculated from the check-in time. Excuses use the excuse-letter review.");
  let effectiveAt = now, proposedStatus;
  if (mode === "checkin") {
    if (payload.effectiveAt !== undefined || payload.requestedStatus) fail(400, "Live check-in time is recorded by the server and cannot be backdated");
    if (isTerminal(event.status) || now > cutoff) fail(400, "Live attendance is closed. Submit a documented correction instead.");
    if (now < window.start) fail(400, "The attendance window has not opened yet");
  } else if (payload.requestedStatus === "absent") {
    if (now <= cutoff) fail(400, "Absence may only be requested after attendance has closed");
    if (payload.effectiveAt !== undefined) fail(400, "Absence uses the event cutoff, not a claimed arrival time");
    effectiveAt = cutoff;
    proposedStatus = "absent";
  } else {
    if (typeof payload.effectiveAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(payload.effectiveAt)) fail(400, "A correction needs the original check-in date/time including its time zone");
    effectiveAt = new Date(payload.effectiveAt);
    if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt > now) fail(400, "The check-in time must be a valid time in the past");
    if (effectiveAt < window.start || effectiveAt > cutoff) fail(400, "The claimed check-in time must be within this event's attendance period");
  }
  proposedStatus ||= effectiveAt <= window.end ? "present" : "late";
  return { mode, reason, identityChecked: true, effectiveAt, submittedAt: now, proposedStatus,
    proposedHours: baseHours(proposedStatus), schedule: { start: window.start, deadline: window.end, cutoff } };
}

function createService(deps) {
  const { Request, Attendance, Event, User, notifyUsers = async () => {} } = deps;
  const populated = query => query.populate("event", "title date time endDate endTime status attendanceStartTime attendanceEndTime manualAttendanceReviewers")
    .populate("student", "name email program yearLevel section").populate("requestedBy", "name email").populate("reviewedBy", "name email");
  function publicRow(value, user) {
    const row = plain(value);
    const result = { ...row, canReview: row.status === "pending" && canReview(user, row.event, row) };
    delete result.reviewLock;
    delete result.previousAttendance;
    if (result.event && typeof result.event === "object") { result.event = { ...result.event }; delete result.event.manualAttendanceReviewers; }
    return result;
  }
  async function submit(user, payload, now = new Date()) {
    if (user?.role !== "organizer") fail(403, "Only event organizers may submit manual attendance requests");
    if (!isValidObjectId(payload.eventId) || !isValidObjectId(payload.studentId)) fail(400, "A valid event and student are required");
    if (idOf(user) === idOf(payload.studentId)) fail(403, "Another organizer must handle your own attendance");
    const [event, student, previous] = await Promise.all([
      Event.findById(payload.eventId), User.findById(payload.studentId).select("role"),
      Attendance.findOne({ event: payload.eventId, student: payload.studentId }).lean(),
    ]);
    if (!event) fail(404, "Event not found");
    if (!student || student.role !== "student") fail(400, "Choose a student account");
    if (previous?.status === "excused" || previous?.method === "face") fail(409, "This student already has face-verified attendance or an approved excuse. Review that record separately.");
    const proposal = buildProposal(event, payload, now);
    if (proposal.mode === "checkin" && previous && previous.status !== "absent" && previous.status !== "pending") fail(409, "Attendance is already recorded. Use a documented correction if needed.");
    let request;
    try {
      request = await Request.create({ ...proposal, event: event._id, student: student._id, requestedBy: user._id,
        previousAttendance: fingerprint(previous), status: "pending" });
    } catch (error) {
      if (error.code === 11000) fail(409, "A manual attendance request is already pending for this student and event");
      throw error;
    }
    return publicRow(await populated(Request.findById(request._id)).lean(), user);
  }
  async function reviewScope(user, view = "review") {
    if (!user || !["student", "organizer", "admin"].includes(user.role)) fail(403, "Sign in to view attendance requests");
    if (user.role === "student") return { student: user._id };
    if (view === "mine") return { requestedBy: user._id };
    if (user.role === "admin") return {};
    const assigned = await Event.find({ manualAttendanceReviewers: user._id }).select("_id").lean();
    return { event: { $in: assigned.map(event => event._id) } };
  }
  async function list(user, query = {}) {
    const scope = await reviewScope(user, query.view || (user.role === "organizer" ? "mine" : "review"));
    const clauses = [scope];
    if (query.eventId) { if (!isValidObjectId(query.eventId)) fail(400, "Invalid event ID"); clauses.push({ event: query.eventId }); }
    if (query.status && query.status !== "all") {
      if (!["pending", "approved", "rejected"].includes(query.status)) fail(400, "Invalid request status");
      clauses.push({ status: query.status });
    }
    if (query.search) {
      const search = String(query.search).trim().slice(0, 150).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const students = await User.find({ $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }).select("_id").lean();
      clauses.push({ student: { $in: students.map(student => student._id) } });
    }
    const filter = { $and: clauses }, pageSize = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    const total = await Request.countDocuments(filter);
    const page = Math.min(Math.max(1, parseInt(query.page, 10) || 1), Math.max(1, Math.ceil(total / pageSize)));
    const requests = await populated(Request.find(filter).sort({ submittedAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize)).lean();
    return { requests: requests.map(request => publicRow(request, user)), total, page, pageSize };
  }
  async function summary(user) {
    const scope = await reviewScope(user, "review");
    const [pendingReview, pendingMine] = await Promise.all([
      user.role === "student" ? 0 : Request.countDocuments({ $and: [scope, { status: "pending", requestedBy: { $ne: user._id }, student: { $ne: user._id } }] }),
      Request.countDocuments({ status: "pending", ...(user.role === "student" ? { student: user._id } : { requestedBy: user._id }) }),
    ]);
    return { pendingReview, pendingMine };
  }
  async function reviewEvents(user) {
    if (!["admin", "organizer"].includes(user?.role)) fail(403, "Review access is required");
    return Event.find(user.role === "admin" ? {} : { manualAttendanceReviewers: user._id })
      .select("title date time endDate endTime status attendanceStartTime attendanceEndTime").sort({ date: -1 }).lean();
  }
  async function reviewers(user, eventId) {
    if (user?.role !== "admin") fail(403, "Only administrators assign event reviewers");
    if (!isValidObjectId(eventId)) fail(400, "Invalid event ID");
    const event = await Event.findById(eventId);
    if (!event) fail(404, "Event not found");
    const candidates = await User.find({ $or: [{ role: "organizer" }, { role: "student", organizerAccess: true }] }).select("name email role organizerAccess").sort({ name: 1 }).lean();
    const assigned = new Set((event.manualAttendanceReviewers || []).map(idOf));
    return { reviewers: candidates.filter(user => assigned.has(idOf(user))), candidates };
  }
  async function assignReviewers(user, payload) {
    if (user?.role !== "admin") fail(403, "Only administrators assign event reviewers");
    if (!isValidObjectId(payload.eventId) || !Array.isArray(payload.userIds) || payload.userIds.length > 20 || payload.userIds.some(id => !isValidObjectId(id))) fail(400, "Choose up to 20 valid reviewer accounts");
    const ids = [...new Set(payload.userIds.map(idOf))];
    const candidates = await User.find({ _id: { $in: ids }, $or: [{ role: "organizer" }, { role: "student", organizerAccess: true }] }).select("_id").lean();
    if (candidates.length !== ids.length) fail(400, "Reviewers must have current organizer access");
    const event = await Event.findByIdAndUpdate(payload.eventId, { $set: { manualAttendanceReviewers: ids } }, { new: true, runValidators: true });
    if (!event) fail(404, "Event not found");
    return reviewers(user, payload.eventId);
  }

  async function reviewOne(user, id, decision, note, now = new Date()) {
    if (!isValidObjectId(id)) fail(400, "Invalid request ID");
    let request = await Request.findById(id).lean();
    if (!request) fail(404, "Request not found");
    const event = await Event.findById(request.event);
    if (!canReview(user, event, request)) fail(403, "An independent administrator or assigned event reviewer must review this request");
    if (request.status !== "pending") {
      if (request.status !== decision) fail(409, "This request has already been reviewed");
      return { id: idOf(request), status: request.status };
    }
    const token = crypto.randomBytes(16).toString("hex");
    request = await Request.findOneAndUpdate({ _id: id, status: "pending", $or: [{ "reviewLock.until": { $exists: false } }, { "reviewLock.until": null }, { "reviewLock.until": { $lte: now } }] },
      { $set: { reviewLock: { token, until: new Date(now.getTime() + 60_000) } } }, { new: true }).lean();
    if (!request) fail(409, "Another reviewer is processing this request. Refresh and try again.");
    try {
      // Recover if attendance was committed but the request finalization failed.
      const alreadyApplied = await Attendance.findOne({ event: request.event, student: request.student, "manualAttendanceAudit.request": request._id }).lean();
      const priorAudit = alreadyApplied?.manualAttendanceAudit?.find(item => idOf(item.request) === idOf(request));
      if (priorAudit) {
        await Request.updateOne({ _id: request._id, status: "pending", "reviewLock.token": token }, { $set: { status: "approved", reviewedBy: priorAudit.reviewedBy, reviewedAt: priorAudit.reviewedAt, reviewNote: priorAudit.reviewNote }, $unset: { reviewLock: 1 } });
        return { id: idOf(request), status: "approved" };
      }
      if (decision === "rejected") {
        // Some finished/manually closed events are no longer visited by the
        // lifecycle job. Rejecting a request must not grant a permanent absence
        // exemption just because no Attendance row was created yet.
        if (now > new Date(request.schedule.cutoff)) {
          try {
            await Attendance.updateOne({ event: request.event, student: request.student }, { $setOnInsert: {
              event: request.event, student: request.student, attendedAt: request.schedule.cutoff,
              status: "absent", method: "auto", communityServiceHours: 8,
              communityServiceLog: [{ action: "penalty", hours: 8, at: now, note: "Marked absent (auto)" }],
            } }, { upsert: true });
          } catch (error) { if (error.code !== 11000) throw error; }
        }
        const result = await Request.updateOne({ _id: request._id, status: "pending", "reviewLock.token": token }, { $set: { status: "rejected", reviewedBy: user._id, reviewedAt: now, reviewNote: note }, $unset: { reviewLock: 1 } });
        if (!result.modifiedCount) fail(409, "The review changed. Refresh and try again.");
        await notifyUsers([request.student], { type: "attendance", title: "Manual attendance request rejected", message: `Your manual attendance request for "${event.title}" was rejected. ${note}`, relatedEvent: event._id, event, deferEmail: true }).catch(() => {});
        return { id: idOf(request), status: "rejected" };
      }
      const student = await User.findById(request.student).select("role");
      if (!student || student.role !== "student") fail(409, "The student account changed. This request cannot be applied.");
      const current = await Attendance.findOne({ event: request.event, student: request.student }).lean();
      if (current?.status === "excused" || current?.method === "face") fail(409, "A face check-in or approved excuse already controls this record. Refresh before reviewing.");
      const expected = request.previousAttendance;
      // An automatic absence may be created while a request is waiting. It
      // must not turn a timely check-in into a late one at review time.
      const logs = current?.communityServiceLog || [];
      const automaticAbsence = current?.status === "absent" && current?.method === "auto" && (current.communityServiceHours || 0) === 8
        && logs.length === 1 && logs[0].action === "penalty" && logs[0].hours === 8 && logs[0].note === "Marked absent (auto)"
        && (!current.createdAt || new Date(current.createdAt) >= new Date(request.submittedAt));
      const unchanged = JSON.stringify(fingerprint(current)) === JSON.stringify(expected);
      if (!unchanged && !(expected === null && automaticAbsence) && !(expected?.method === "auto" && expected?.status === "absent" && expected?.hours === 8 && !current)) fail(409, "Attendance changed after this request was submitted. Reject it and submit a fresh correction if needed.");
      const previousHours = current?.communityServiceHours || 0;
      const nextHours = Math.max(0, request.proposedHours + (current ? previousHours - baseHours(current.status) : 0));
      const audit = { request: request._id, requestedBy: request.requestedBy, reviewedBy: user._id, submittedAt: request.submittedAt,
        effectiveAt: request.effectiveAt, reviewedAt: now, reason: request.reason, reviewNote: note,
        previousStatus: current?.status || "unrecorded", nextStatus: request.proposedStatus, previousHours, nextHours };
      const changes = { status: request.proposedStatus, method: "manual", attendedAt: request.effectiveAt, verifiedAt: now,
        communityServiceHours: nextHours, manualAttendanceRequest: request._id };
      const delta = nextHours - previousHours;
      const log = delta ? [{ action: delta > 0 ? "penalty" : "removed", hours: Math.abs(delta), at: now,
        note: `Manual attendance approved (${idOf(request)}): ${request.reason}` }] : [];
      if (current) {
        const filter = { _id: current._id, status: current.status, method: current.method, communityServiceHours: previousHours,
          ...(current.updatedAt ? { updatedAt: current.updatedAt } : { updatedAt: { $exists: false } }) };
        const result = await Attendance.updateOne(filter, { $set: changes, $push: { manualAttendanceAudit: audit, ...(log.length ? { communityServiceLog: { $each: log } } : {}) }, $inc: { __v: 1 } });
        if (!result.modifiedCount) fail(409, "Attendance changed during review. Refresh before trying again.");
      } else {
        try { await Attendance.create({ event: request.event, student: request.student, ...changes, manualAttendanceAudit: [audit], communityServiceLog: log }); }
        catch (error) { if (error.code === 11000) fail(409, "Attendance was recorded during review. Refresh and try again."); throw error; }
      }
      const finalized = await Request.updateOne({ _id: request._id, status: "pending", "reviewLock.token": token }, { $set: { status: "approved", reviewedBy: user._id, reviewedAt: now, reviewNote: note }, $unset: { reviewLock: 1 } });
      if (!finalized.modifiedCount) fail(409, "Attendance was applied; refresh the request to recover its review status.");
      await notifyUsers([request.student], { type: "attendance", title: "Manual attendance approved", message: `Your attendance for "${event.title}" was approved as ${request.proposedStatus}. It uses your recorded check-in time, not the approval time.`, relatedEvent: event._id, event, deferEmail: true }).catch(() => {});
      return { id: idOf(request), status: "approved" };
    } finally {
      await Request.updateOne({ _id: request._id, status: "pending", "reviewLock.token": token }, { $unset: { reviewLock: 1 } }).catch(() => {});
    }
  }
  async function reviewBatch(user, payload) {
    if (!["admin", "organizer"].includes(user?.role)) fail(403, "Review access is required");
    if (!Array.isArray(payload.ids) || !payload.ids.length || payload.ids.length > 50) fail(400, "Select between 1 and 50 requests");
    const decision = payload.decision, note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (!["approved", "rejected"].includes(decision)) fail(400, "Choose approve or reject");
    if (decision === "approved" && payload.verifiedPresence !== true) fail(400, "Confirm independent verification before approving selected requests");
    if (note.length > 1000 || (decision === "rejected" && note.length < 5)) fail(400, "Give a rejection reason between 5 and 1000 characters");
    const results = [];
    for (const id of [...new Set(payload.ids.map(String))]) {
      try { results.push(await reviewOne(user, id, decision, note)); }
      catch (error) { results.push({ id, status: "error", error: error.status ? error.message : "Review could not be completed. Refresh and try again.", code: error.status || 500 }); }
    }
    return { results };
  }
  async function pendingManualEventsForStudent(studentId) {
    return Request.find({ student: studentId, status: "pending" }).populate("event", "title date time endDate endTime status attendanceStartTime attendanceEndTime")
      .populate("requestedBy", "name email").select("event student requestedBy proposedStatus proposedHours effectiveAt submittedAt status").lean();
  }
  return { submit, list, summary, reviewEvents, reviewers, assignReviewers, reviewBatch, reviewOne, pendingManualEventsForStudent };
}

let defaultService;
function service() {
  return defaultService ||= createService({ Request: require("../models/ManualAttendanceRequest"), Attendance: require("../models/Attendance"),
    Event: require("../models/Event"), User: require("../models/User"), notifyUsers: require("./notify").notifyUsers });
}
const names = ["submit", "list", "summary", "reviewEvents", "reviewers", "assignReviewers", "reviewBatch", "pendingManualEventsForStudent"];
module.exports = { createService, buildProposal, canReview, fingerprint, baseHours, ...Object.fromEntries(names.map(name => [name, (...args) => service()[name](...args)])) };
