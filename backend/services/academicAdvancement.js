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
function validateClassScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope) ||
      !["BSIT", "BSCS", "BSEMC"].includes(scope.program) ||
      !Number.isInteger(scope.yearLevel) || scope.yearLevel < 1 || scope.yearLevel > 4 ||
      !["A", "B", "C"].includes(scope.section)) fail(400, "Choose a valid program, year level and section.");
  return { program: scope.program, yearLevel: scope.yearLevel, section: scope.section };
}
const inClass = (student, scope) => !scope ||
  (student.program === scope.program && student.yearLevel === scope.yearLevel && student.section === scope.section);
async function readRoster() {
  return User.find({ role: "student" })
    .select("name email role program section yearLevel academicYearStart enrollmentStatus").sort({ name: 1, _id: 1 }).lean();
}
async function studentOptions(sourceYear) {
  const issue = sourceYearIssue(sourceYear);
  if (issue) fail(400, issue);
  const groups = new Map();
  const students = (await readRoster()).filter(student => isEligible(student,sourceYear));
  for (const student of students) {
    const key = `${student.program}:${student.yearLevel}:${student.section}`;
    if (!groups.has(key)) groups.set(key, { key, program: student.program, yearLevel: student.yearLevel, section: student.section, count: 0 });
    groups.get(key).count++;
  }
  return {
    classes: [...groups.values()].sort((a,b) => a.program.localeCompare(b.program) || a.yearLevel-b.yearLevel || a.section.localeCompare(b.section)),
    students: students.map(student => ({ _id: student._id, name: student.name, email: student.email,
      program: student.program, yearLevel: student.yearLevel, section: student.section })),
  };
}
async function listClasses(sourceYear) { return (await studentOptions(sourceYear)).classes; }
async function preview(adminId, sourceYear, classScope = null, explicitSelection = false) {
  const issue = sourceYearIssue(sourceYear);
  if (issue) fail(400, issue);
  const scope = classScope === null ? null : validateClassScope(classScope);
  const roster = (await readRoster()).filter(student => inClass(student, scope));
  const students = roster.filter(student => isEligible(student, sourceYear));
  if (!students.length) return { batchId: null, sourceYear, targetYear: sourceYear + 1, classScope: scope, students: [], excludedCount: roster.length };
  const batch = await AcademicAdvancement.create({
    createdBy: adminId, sourceYear, targetYear: sourceYear + 1, classScope: scope, students, ...(explicitSelection?{selectionMode:"explicit"}:{}),
  });
  return { batchId: batch._id, sourceYear, targetYear: sourceYear + 1, classScope: scope, students: batch.students,
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
async function commit(adminId, batchId, retainedIds = [], graduateIds = [], selectedIds) {
  let batch = await AcademicAdvancement.findById(batchId);
  if (!batch || String(batch.createdBy) !== String(adminId)) fail(404, "Batch not found. Prepare a new preview.");
  if (!["draft", "running", "partial", "completed"].includes(batch.status)) fail(409, "This batch is being undone or has already been undone. Reload the masterlist to prepare a new update.");
  validateChoices(batch, retainedIds, graduateIds);
  if(batch.selectionMode==="explicit"&&selectedIds===undefined)fail(400,"Check the students to advance before confirming.");
  if(selectedIds!==undefined&&(!Array.isArray(selectedIds)||!selectedIds.length||new Set(selectedIds).size!==selectedIds.length||
    selectedIds.some(id=>typeof id!=="string"||!batch.students.some(student=>String(student._id)===id))||
    graduateIds.some(id=>!selectedIds.includes(id))||retainedIds.length))fail(400,"Select students to advance or graduate before confirming.");
  if(selectedIds!==undefined&&!sameIds(graduateIds,batch.students.filter(student=>student.yearLevel===4&&selectedIds.includes(String(student._id))).map(student=>String(student._id))))fail(400,"Explicitly confirm graduation for selected fourth-year students.");
  if (batch.status === "draft") {
    if (Date.now() - new Date(batch.createdAt).getTime() > 60 * 60 * 1000) fail(409, "Preview expired. Reload the masterlist and review again.");
    batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: "draft" },
      { $set: { status: "running", retainedIds, graduateIds, ...(selectedIds!==undefined?{selectedIds}:{}) } }, { new: true }) || await AcademicAdvancement.findById(batchId);
  }
  if (!sameIds(batch.retainedIds, retainedIds) || !sameIds(batch.graduateIds, graduateIds)) {
    fail(409, "This batch already started with different selections. Retry the original selections or prepare a new preview.");
  }
  if((batch.selectedIds!==undefined||selectedIds!==undefined)&&(!batch.selectedIds||!selectedIds||!sameIds(batch.selectedIds,selectedIds)))fail(409,"This batch already started with different students. Retry the original selection.");
  if (batch.status === "completed") return summarize(batch);
  const retained = new Set(batch.retainedIds), graduates = new Set(batch.graduateIds);
  const results = [];
  for (const student of batch.students) {
    const id = String(student._id);
    if(batch.selectedIds!==undefined&&!batch.selectedIds.includes(id)){results.push({studentId:id,name:student.name,outcome:"unchanged"});continue;}
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
  require("./faceIdentify").clear();
  return summarize(batch);
}
function canFinishUndo(snapshot, current, batch) {
  const transition=current?.academicTransitions?.find(item=>String(item.batch)===String(batch._id));
  const latest=current?.academicTransitions?.filter(item=>!item.revertedAt).at(-1);
  return !!transition&&!transition.revertedAt&&String(latest?.batch)===String(batch._id)&&current.role==="student"&&
    current.program===snapshot.program&&current.section===snapshot.section&&current.yearLevel===snapshot.yearLevel&&
    (current.enrollmentStatus||"active")===(snapshot.enrollmentStatus||"active")&&
    [batch.targetYear,snapshot.academicYearStart??null].includes(current.academicYearStart??null)&&
    !(current.yearLevel===transition.toYearLevel&&(current.enrollmentStatus||"active")===transition.toStatus&&current.academicYearStart===batch.targetYear);
}
async function undoPreview(batchId) {
  const batch=await AcademicAdvancement.findById(batchId);
  if(!batch)fail(404,"Academic update not found.");
  if(!["completed","partial","reverting","undo_partial","undone"].includes(batch.status))fail(409,"Wait for the update to finish before undoing it.");
  const current=await User.find({_id:{$in:batch.students.map(student=>student._id)}})
    .select("role program section yearLevel academicYearStart enrollmentStatus academicTransitions").lean();
  const byId=new Map(current.map(student=>[String(student._id),student]));
  const reconciliation=batch.students.filter(snapshot=>canFinishUndo(snapshot,byId.get(String(snapshot._id)),batch))
    .map(snapshot=>({studentId:String(snapshot._id),name:snapshot.name,email:snapshot.email,yearLevel:snapshot.yearLevel,
      fromSchoolYear:batch.targetYear,toSchoolYear:snapshot.academicYearStart??batch.sourceYear}));
  return {batch:summarize(batch),reconciliation};
}
async function undo(adminId, batchId, reconcileStudentIds = []) {
  let batch = await AcademicAdvancement.findById(batchId);
  if (!batch) fail(404, "Academic update not found.");
  if(!Array.isArray(reconcileStudentIds)||new Set(reconcileStudentIds).size!==reconcileStudentIds.length||
    reconcileStudentIds.some(id=>typeof id!=="string"||!batch.students.some(student=>String(student._id)===id)))fail(400,"Undo recovery selections must belong to this update.");
  const reconcile=new Set(reconcileStudentIds);
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
      const finishPreviousYear=reconcile.has(id)&&canFinishUndo(snapshot,current,batch);
      // Compare the complete resulting academic standing, then protect the
      // read/write gap. Later staff edits are never silently overwritten.
      const updated = await User.findOneAndUpdate({
        _id: snapshot._id, role: "student", program: snapshot.program, section: snapshot.section,
        yearLevel: finishPreviousYear?current.yearLevel:transition.toYearLevel,
        academicYearStart: finishPreviousYear?(current.academicYearStart??null):batch.targetYear,
        enrollmentStatus: finishPreviousYear?(current.enrollmentStatus||{$in:[null,"active"]}):transition.toStatus,
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
          results.push({ ...result, outcome: "skipped", message: canFinishUndo(snapshot,current,batch)
            ? "Year level is already restored, but the school-year rollback is unfinished. Use Retry undo to review and finish it."
            : "Student academic details changed after this update. Review the student manually; no changes were overwritten." });
          continue;
        }
      }
      results.push({ ...result, outcome: "restored" });
    } catch {
      results.push({ ...result, outcome: "failed", message: "Could not restore this student. Retry undo; restored students will not change again." });
    }
  }
  const undoComplete=!results.some(item=>["skipped","failed"].includes(item.outcome));
  batch = await AcademicAdvancement.findOneAndUpdate({ _id: batchId, status: { $in: ["reverting", "undo_partial"] } }, {
    $set: { status: undoComplete?"undone":"undo_partial",
      undoResults: results, undoneBy: adminId, ...(undoComplete?{undoneAt:new Date()}:{}) },
  }, { new: true }) || await AcademicAdvancement.findById(batchId);
  require("./faceIdentify").clear();
  return summarize(batch);
}
async function history(query = {}) {
  const filter = { status: { $nin: ["draft", "undone"] } }, limit = 5;
  const total = await AcademicAdvancement.countDocuments(filter);
  const page = Math.min(Math.max(1, parseInt(query.page, 10) || 1), Math.max(1, Math.ceil(total / limit)));
  const batches = await AcademicAdvancement.find(filter)
    .select("sourceYear targetYear classScope status createdAt undoneAt results undoResults")
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { batches: batches.map(summarize), total, page, pageSize: limit };
}
function summarize(batch) {
  return { batchId: batch._id, sourceYear: batch.sourceYear, targetYear: batch.targetYear, classScope: batch.classScope || null, status: batch.status,
    createdAt: batch.createdAt, unchangedCount:batch.results.filter(result=>result.outcome==="unchanged").length, undoneAt: batch.status==="undone"?batch.undoneAt:null,
    undo: { counts: Object.fromEntries(["restored", "unaffected", "skipped", "failed"].map(key => [key, (batch.undoResults || []).filter(result => result.outcome === key).length])),
      issues: (batch.undoResults || []).filter(result => ["skipped", "failed"].includes(result.outcome)) },
    counts: Object.fromEntries(["advanced", "retained", "graduated", "skipped", "failed"].map(key => [key, batch.results.filter(result => result.outcome === key).length])),
    issues: batch.results.filter(result => ["skipped", "failed"].includes(result.outcome)) };
}
async function details(batchId, query = {}) {
  const batch = await AcademicAdvancement.findById(batchId);
  if (!batch || batch.status === "draft") fail(404, "Saved academic update not found.");
  const outcomes = new Map((batch.results || []).map(item => [String(item.studentId), item]));
  const undos = new Map((batch.undoResults || []).map(item => [String(item.studentId), item]));
  const search = String(query.search || "").trim().slice(0,150).toLowerCase();
  const students = (batch.students || []).filter(student =>
    `${student.name || ""} ${student.email || ""}`.toLowerCase().includes(search));
  const pageSize = 5, total = students.length;
  const page = Math.min(Math.max(1, parseInt(query.page,10) || 1), Math.max(1, Math.ceil(total / pageSize)));
  const rows = students.slice((page-1)*pageSize,page*pageSize).map(student => {
    const saved = outcomes.get(String(student._id)), undo = undos.get(String(student._id));
    const outcome = saved?.outcome || "pending";
    return { studentId: student._id, name: student.name, email: student.email,
      program: student.program, section: student.section, previousYearLevel: student.yearLevel,
      updatedYearLevel: outcome === "advanced" ? student.yearLevel+1 : ["retained","graduated","unchanged"].includes(outcome) ? student.yearLevel : null,
      outcome, message: saved?.message || "", undoOutcome: undo?.outcome || null, undoMessage: undo?.message || "" };
  });
  // Read saved snapshots, not the current class query: promotion, graduation,
  // later edits or deleted accounts must not erase the historical result.
  return { batch: summarize(batch), students: rows, total, batchSize: (batch.students || []).length, page, pageSize };
}
module.exports = { preview, commit, undo, undoPreview, history, details, studentOptions, listClasses, sourceYearIssue, isEligible, plannedChange };
