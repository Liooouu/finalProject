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
          "academicTransitions.toSchoolYear": { $ne: batch.targetYear },
        }, {
          $set: { yearLevel: change.yearLevel, enrollmentStatus: change.enrollmentStatus, academicYearStart: batch.targetYear },
          $push: {
            academicHistory: { schoolYearStart: batch.sourceYear, yearLevel: student.yearLevel, program: student.program, section: student.section },
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
  batch = await AcademicAdvancement.findByIdAndUpdate(batchId, {
    $set: { results, status: results.some(result => result.outcome === "failed") ? "partial" : "completed" },
  }, { new: true });
  return summarize(batch);
}
function summarize(batch) {
  return { batchId: batch._id, sourceYear: batch.sourceYear, targetYear: batch.targetYear, status: batch.status,
    counts: Object.fromEntries(["advanced", "retained", "graduated", "skipped", "failed"].map(key => [key, batch.results.filter(result => result.outcome === key).length])),
    issues: batch.results.filter(result => ["skipped", "failed"].includes(result.outcome)) };
}
module.exports = { preview, commit, sourceYearIssue, isEligible, plannedChange };
