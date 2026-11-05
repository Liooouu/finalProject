const User = require("../models/User");
const AcademicAdvancement = require("../models/AcademicAdvancement");
const { schoolYearStart } = require("./academicCalendar");

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const sameIds = (a, b) => [...a].sort().join(",") === [...b].sort().join(",");
function sourceYearIssue(year, now = new Date()) {
  return !Number.isInteger(year) || year < 2026 || year > Math.max(2026, schoolYearStart(now))
    ? "Choose an existing school year from 2026 onward. Advance one school year at a time." : "";
}
function isEligible(student, sourceYear) {
  return student.role === "student" && student.enrollmentStatus !== "graduated" &&
    [1, 2, 3, 4].includes(student.yearLevel) && ["BSIT", "BSCS", "BSEMC"].includes(student.program) &&
    /^[ABC]$/.test(student.section || "") &&
    (student.academicYearStart == null || student.academicYearStart === sourceYear);
}
function plannedChange(student, retained, graduate) {
  if (graduate) return { action: "graduated", yearLevel: 4, enrollmentStatus: "graduated" };
  if (retained || student.yearLevel === 4) return { action: "retained", yearLevel: student.yearLevel, enrollmentStatus: "active" };
  return { action: "advanced", yearLevel: student.yearLevel + 1, enrollmentStatus: "active" };
}
async function preview(adminId, sourceYear) {
  const issue = sourceYearIssue(sourceYear);
  if (issue) fail(400, issue);
  const roster = await User.find({ role: "student" })
    .select("name email role program section yearLevel academicYearStart enrollmentStatus").sort({ name: 1, _id: 1 }).lean();
  const students = roster.filter(student => isEligible(student, sourceYear));
  if (!students.length) return { batchId: null, sourceYear, targetYear: sourceYear + 1, students: [], excludedCount: roster.length };
  const batch = await AcademicAdvancement.create({
    createdBy: adminId, sourceYear, targetYear: sourceYear + 1, students,
  });
  return { batchId: batch._id, sourceYear, targetYear: sourceYear + 1, students: batch.students,
    excludedCount: roster.length - students.length };
}
function validateChoices(batch, retainedIds, graduateIds) {
  if (!Array.isArray(retainedIds) || !Array.isArray(graduateIds) ||
      [...retainedIds, ...graduateIds].some(id => typeof id !== "string")) fail(400, "Invalid student selections.");
  const students = new Map(batch.students.map(student => [String(student._id), student]));
  if (new Set(retainedIds).size !== retainedIds.length || new Set(graduateIds).size !== graduateIds.length ||
      [...retainedIds, ...graduateIds].some(id => !students.has(id)) ||
      graduateIds.some(id => students.get(id).yearLevel !== 4 || retainedIds.includes(id))) {
    fail(400, "Selections must belong to this batch. Only fourth-year students can be marked graduated, separately from retained students.");
  }
}
async function commit(adminId, batchId, retainedIds = [], graduateIds = []) {
  let batch = await AcademicAdvancement.findById(batchId);
  if (!batch || String(batch.createdBy) !== String(adminId)) fail(404, "Batch not found. Prepare a new preview.");
  if (!["draft", "running", "partial", "completed"].includes(batch.status)) fail(409, "This batch is being undone or has already been undone. Reload the masterlist to prepare a new update.");
  validateChoices(batch, retainedIds, graduateIds);
  if (batch.status === "draft") {
    if (Date.now() - new Date(batch.createdAt).getTime() > 60 * 60 * 1000) fail(409, "Preview expired. Reload the masterlist and review again.");
    batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: "draft" },
      { $set: { status: "running", retainedIds, graduateIds } }, { new: true }) || await AcademicAdvancement.findById(batchId);
  }
  if (!sameIds(batch.retainedIds, retainedIds) || !sameIds(batch.graduateIds, graduateIds)) {
    fail(409, "This batch already started with different selections. Retry the original selections or prepare a new preview.");
  }
  if (batch.status === "completed") return summarize(batch);
  const retained = new Set(batch.retainedIds), graduates = new Set(batch.graduateIds);
  const results = [];
  for (const student of batch.students) {
    const id = String(student._id);
    const change = plannedChange(student, retained.has(id), graduates.has(id));
    try {
      const applied = await User.exists({ _id: student._id, "academicTransitions.batch": batch._id });
      if (!applied) {
        // One atomic document write protects against duplicate clicks, other
        // batches, and an academic edit made after the administrator's preview.
        const updated = await User.findOneAndUpdate({
          _id: student._id, role: "student", yearLevel: student.yearLevel,
          program: student.program, section: student.section,
          enrollmentStatus: student.enrollmentStatus || { $in: [null, "active"] },
          academicYearStart: student.academicYearStart ?? null,
          academicTransitions: { $not: { $elemMatch: { toSchoolYear: batch.targetYear, revertedAt: null } } },
        }, {
          $set: { yearLevel: change.yearLevel, enrollmentStatus: change.enrollmentStatus, academicYearStart: batch.targetYear },
          $push: {
            academicHistory: { batch: batch._id, schoolYearStart: batch.sourceYear, yearLevel: student.yearLevel, program: student.program, section: student.section },
            academicTransitions: { batch: batch._id, by: adminId, at: new Date(), action: change.action,
              fromSchoolYear: batch.sourceYear, toSchoolYear: batch.targetYear,
              fromYearLevel: student.yearLevel, toYearLevel: change.yearLevel,
              fromStatus: student.enrollmentStatus || "active", toStatus: change.enrollmentStatus,
              program: student.program, section: student.section },
          },
        }, { new: true, runValidators: true }).select("_id");
        if (!updated) {
          // A concurrent retry may have applied this exact batch first.
          if (!await User.exists({ _id: student._id, "academicTransitions.batch": batch._id })) {
            results.push({ studentId: id, name: student.name, outcome: "skipped", message: "Record changed or was processed elsewhere. Refresh and review this student." });
            continue;
          }
        }
      }
      results.push({ studentId: id, name: student.name, outcome: change.action });
    } catch {
      results.push({ studentId: id, name: student.name, outcome: "failed", message: "Could not save. Retry this batch; completed students will not advance again." });
    }
  }
  // A late concurrent confirmation must not overwrite an undo's status.
  batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: { $in: ["running", "partial"] } }, {
    $set: { results, status: results.some(result => result.outcome === "failed") ? "partial" : "completed" },
  }, { new: true }) || await AcademicAdvancement.findById(batchId);
  return summarize(batch);
}
async function undo(adminId, batchId) {
  let batch = await AcademicAdvancement.findById(batchId);
  if (!batch) fail(404, "Academic update not found.");
  if (batch.status === "undone") return summarize(batch);
  if (!["completed", "partial", "reverting", "undo_partial"].includes(batch.status)) fail(409, "Wait for the academic update to finish before undoing it.");
  batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: { $in: ["completed", "partial", "undo_partial"] } },
    { $set: { status: "reverting" } }, { new: true }) || await AcademicAdvancement.findById(batchId);
  if (batch.status === "undone") return summarize(batch);
  const results = [];
  for (const snapshot of batch.students) {
    const id = String(snapshot._id), result = { studentId: id, name: snapshot.name };
    try {
      const current = await User.findById(snapshot._id)
        .select("role program section yearLevel academicYearStart enrollmentStatus academicTransitions updatedAt").lean();
      const transition = current?.academicTransitions?.find(item => String(item.batch) === String(batch._id));
      if (!transition) {
        results.push({ ...result, outcome: "unaffected", message: "This batch did not update this student, or the account no longer exists." });
        continue;
      }
      if (transition.revertedAt) { results.push({ ...result, outcome: "restored" }); continue; }
      const latest = current.academicTransitions.filter(item => !item.revertedAt).at(-1);
      if (String(latest?.batch) !== String(batch._id)) {
        results.push({ ...result, outcome: "skipped", message: "A newer academic update exists. Undo that update first." });
        continue;
      }
      const restoredAt = new Date();
      // Compare the complete resulting academic standing, then protect the
      // read/write gap. Later staff edits are never silently overwritten.
      const updated = await User.findOneAndUpdate({
        _id: snapshot._id, role: "student", program: snapshot.program, section: snapshot.section,
        yearLevel: transition.toYearLevel, academicYearStart: batch.targetYear, enrollmentStatus: transition.toStatus,
        updatedAt: current.updatedAt || { $exists: false },
        academicTransitions: { $elemMatch: { batch: batch._id, revertedAt: null } },
      }, {
        $set: { yearLevel: snapshot.yearLevel, academicYearStart: snapshot.academicYearStart ?? null,
          enrollmentStatus: snapshot.enrollmentStatus || "active",
          "academicTransitions.$[transition].revertedAt": restoredAt,
          "academicTransitions.$[transition].revertedBy": adminId },
        $pull: { academicHistory: { batch: batch._id } },
      }, { new: true, runValidators: true, arrayFilters: [{ "transition.batch": batch._id, "transition.revertedAt": null }] }).select("_id");
      if (!updated) {
        // Another undo may have completed the same student first.
        const fresh = await User.findById(snapshot._id).select("academicTransitions").lean();
        if (!fresh?.academicTransitions?.some(item => String(item.batch) === String(batch._id) && item.revertedAt)) {
          results.push({ ...result, outcome: "skipped", message: "Student details changed after this update. Review the student manually; no changes were overwritten." });
          continue;
        }
      }
      results.push({ ...result, outcome: "restored" });
    } catch {
      results.push({ ...result, outcome: "failed", message: "Could not restore this student. Retry undo; restored students will not change again." });
    }
  }
  batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: { $in: ["reverting", "undo_partial"] } }, {
    $set: { status: results.some(item => ["skipped", "failed"].includes(item.outcome)) ? "undo_partial" : "undone",
      undoResults: results, undoneBy: adminId, undoneAt: new Date() },
  }, { new: true }) || await AcademicAdvancement.findById(batchId);
  return summarize(batch);
}
async function history(query = {}) {
  const filter = { status: { $ne: "draft" } }, limit = 5;
  const total = await AcademicAdvancement.countDocuments(filter);
  const page = Math.min(Math.max(1, parseInt(query.page, 10) || 1), Math.max(1, Math.ceil(total / limit)));
  const batches = await AcademicAdvancement.find(filter)
    .select("sourceYear targetYear status createdAt undoneAt results undoResults")
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { batches: batches.map(summarize), total, page, pageSize: limit };
}
function summarize(batch) {
  return { batchId: batch._id, sourceYear: batch.sourceYear, targetYear: batch.targetYear, status: batch.status,
    createdAt: batch.createdAt, undoneAt: batch.undoneAt,
    undo: { counts: Object.fromEntries(["restored", "unaffected", "skipped", "failed"].map(key => [key, (batch.undoResults || []).filter(result => result.outcome === key).length])),
      issues: (batch.undoResults || []).filter(result => ["skipped", "failed"].includes(result.outcome)) },
    counts: Object.fromEntries(["advanced", "retained", "graduated", "skipped", "failed"].map(key => [key, batch.results.filter(result => result.outcome === key).length])),
    issues: batch.results.filter(result => ["skipped", "failed"].includes(result.outcome)) };
}
module.exports = { preview, commit, undo, history, sourceYearIssue, isEligible, plannedChange };
