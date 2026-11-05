const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
let users, batches, serial, failStudent;
const copy = value => structuredClone(value);
const query = read => ({ select() { return this; }, sort() { return this; }, lean() { return Promise.resolve(read()); }, then(ok, bad) { return Promise.resolve().then(read).then(ok, bad); } });
const userModel = {
  find: () => query(() => [...users.values()].map(copy)),
  findById: id => query(() => users.has(String(id)) ? copy(users.get(String(id))) : null),
  exists: async filter => users.get(String(filter._id))?.academicTransitions?.some(record => String(record.batch) === String(filter["academicTransitions.batch"])) || null,
  findOneAndUpdate: (filter, update) => query(() => {
    const student = users.get(String(filter._id));
    if (String(filter._id) === failStudent) throw Error("Temporary database failure");
    if (!student || !["role", "yearLevel", "program", "section"].every(field => student[field] === filter[field]) ||
        (student.academicYearStart ?? null) !== filter.academicYearStart ||
        (typeof filter.enrollmentStatus === "string" ? student.enrollmentStatus !== filter.enrollmentStatus : student.enrollmentStatus && student.enrollmentStatus !== "active") ||
        (filter.academicTransitions?.$not && student.academicTransitions?.some(record => record.toSchoolYear === filter.academicTransitions.$not.$elemMatch.toSchoolYear && !record.revertedAt)) ||
        (filter.academicTransitions?.$elemMatch && !student.academicTransitions?.some(record => String(record.batch) === String(filter.academicTransitions.$elemMatch.batch) && !record.revertedAt))) return null;
    const matchingTransitions=(student.academicTransitions||[]).filter(record=>String(record.batch)===String(filter.academicTransitions?.$elemMatch?.batch)&&!record.revertedAt);
    for(const [key,value] of Object.entries(update.$set || {})){
      if(key.startsWith('academicTransitions.$[transition].')){
        for(const transition of matchingTransitions)transition[key.split('.').at(-1)]=copy(value);
      }else student[key]=copy(value);
    }
    for (const [key, entry] of Object.entries(update.$push || {})) (student[key] ||= []).push(copy(entry));
    if(update.$pull?.academicHistory)student.academicHistory=student.academicHistory.filter(item=>String(item.batch)!==String(update.$pull.academicHistory.batch));
    return copy(student);
  }),
};
const batchModel = {
  create: async data => {
    const batch = { _id: `batch-${++serial}`, ...copy(data), createdAt: new Date(), status: "draft", retainedIds: [], graduateIds: [], results: [] };
    batches.set(batch._id, batch); return copy(batch);
  },
  findById: async id => copy(batches.get(String(id))),
  findOneAndUpdate: async (filter, update) => {
    const batch = batches.get(String(filter._id));
    if (!batch || (typeof filter.status==='string' ? batch.status !== filter.status : !filter.status.$in.includes(batch.status))) return null;
    Object.assign(batch, copy(update.$set)); return copy(batch);
  },
  findByIdAndUpdate: async (id, update) => { const batch = batches.get(String(id)); Object.assign(batch, copy(update.$set)); return copy(batch); },
};
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === "../models/User") return userModel;
  if (name === "../models/AcademicAdvancement") return batchModel;
  return originalLoad.call(this, name, parent, ...rest);
};
const { preview, commit, undo, sourceYearIssue, isEligible } = require("../services/academicAdvancement");
Module._load = originalLoad;

beforeEach(() => {
  batches = new Map(); serial = 0; failStudent = "";
  users = new Map(Array.from({ length: 14 }, (_, index) => [`student-${index}`, {
    _id: `student-${index}`, name: `Student ${index}`, email: `student${index}@example.test`, role: "student",
    program: "BSIT", section: "A", yearLevel: index === 13 ? 4 : 1, academicYearStart: 2026,
    enrollmentStatus: "active", organizerAccess: index === 3,
    academicHistory: [], academicTransitions: [], faceDescriptor: [0.123], serviceBalance: 24,
  }]));
});
test("only 2026 onward source years up to the current school year are accepted", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  assert.equal(sourceYearIssue(2026, now), "");
  for (const year of [2025, 2027, "2026", 2026.5]) assert.ok(sourceYearIssue(year, now));
});
test("preview includes the entire eligible roster once, including promoted students", async () => {
  users.set("admin", { _id: "admin", role: "admin" });
  users.set("graduate", { ...users.get("student-0"), _id: "graduate", enrollmentStatus: "graduated" });
  const batch = await preview("admin", 2026);
  assert.equal(batch.students.length, 14); assert.equal(batch.excludedCount, 2);
  assert.equal(users.get("student-0").yearLevel, 1); assert.equal(users.get("student-0").academicHistory.length, 0);
  assert.equal(isEligible({ ...users.get("student-0"), program: "OTHER" }, 2026), false);
  assert.equal(isEligible({ ...users.get("student-0"), academicYearStart: 2027 }, 2026), false);
});
test("confirmation advances all pages, retains selected exceptions, and preserves other records", async () => {
  const batch = await preview("admin", 2026);
  const result = await commit("admin", batch.batchId, ["student-11"], []);
  assert.deepEqual(result.counts, { advanced: 12, retained: 2, graduated: 0, skipped: 0, failed: 0 });
  for (const student of users.values()) {
    assert.equal(student.academicYearStart, 2027);
    assert.equal(student.academicHistory[0].schoolYearStart, 2026);
    assert.equal(student.program, "BSIT"); assert.equal(student.section, "A");
    assert.equal(student.serviceBalance, 24); assert.deepEqual(student.faceDescriptor, [0.123]);
    assert.equal(student.academicTransitions[0].by, "admin");
  }
  assert.equal(users.get("student-11").yearLevel, 1);
  assert.equal(users.get("student-13").yearLevel, 4);
  assert.equal(users.get("student-13").enrollmentStatus, "active");
  assert.equal(users.get("student-3").organizerAccess, true);
});
test("graduation requires an explicit fourth-year selection", async () => {
  const batch = await preview("admin", 2026);
  await assert.rejects(commit("admin", batch.batchId, [], ["student-0"]), { status: 400 });
  await assert.rejects(commit("admin", batch.batchId, ["student-13"], ["student-13"]), { status: 400 });
  await commit("admin", batch.batchId, [], ["student-13"]);
  assert.equal(users.get("student-13").enrollmentStatus, "graduated");
});
test("repeated and concurrent confirmations do not double-advance or duplicate history", async () => {
  const batch = await preview("admin", 2026);
  await Promise.all([commit("admin", batch.batchId), commit("admin", batch.batchId)]);
  await commit("admin", batch.batchId);
  for (const student of users.values()) { assert.equal(student.academicHistory.length, 1); assert.equal(student.academicTransitions.length, 1); }
  const empty = await preview("admin", 2026);
  assert.equal(empty.students.length, 0); assert.equal(empty.batchId, null);
});
test("two independently prepared batches cannot advance the same student twice", async () => {
  const first = await preview("admin", 2026), second = await preview("admin", 2026);
  await commit("admin", first.batchId);
  const result = await commit("admin", second.batchId);
  assert.equal(result.counts.skipped, 14);
  assert.equal(users.get("student-0").yearLevel, 2);
});
test("an academic edit or deletion after preview is skipped without overwriting it", async () => {
  const batch = await preview("admin", 2026);
  users.get("student-1").section = "B"; users.delete("student-2");
  const result = await commit("admin", batch.batchId);
  assert.equal(result.counts.skipped, 2); assert.equal(users.get("student-1").section, "B");
  assert.equal(users.get("student-1").academicYearStart, 2026);
});
test("partial database failures can be retried safely using the reviewed selections", async () => {
  const batch = await preview("admin", 2026); failStudent = "student-5";
  const result = await commit("admin", batch.batchId, ["student-1"]);
  assert.equal(result.status, "partial"); assert.equal(result.counts.failed, 1);
  await assert.rejects(commit("admin", batch.batchId, []), { status: 409 });
  failStudent = "";
  const retried = await commit("admin", batch.batchId, ["student-1"]);
  assert.equal(retried.status, "completed"); assert.equal(retried.counts.failed, 0);
  assert.equal(users.get("student-0").yearLevel, 2); assert.equal(users.get("student-0").academicHistory.length, 1);
});
test("foreign, duplicate, expired, or another admin's selections cannot be committed", async () => {
  const batch = await preview("admin", 2026);
  await assert.rejects(commit("other-admin", batch.batchId), { status: 404 });
  await assert.rejects(commit("admin", batch.batchId, ["unknown"]), { status: 400 });
  await assert.rejects(commit("admin", batch.batchId, ["student-1", "student-1"]), { status: 400 });
  batches.get(batch.batchId).createdAt = new Date(Date.now() - 3600001);
  await assert.rejects(commit("admin", batch.batchId), { status: 409 });
});
test("legacy students without a school-year anchor retain their prior standing in history", async () => {
  delete users.get("student-0").academicYearStart; delete users.get("student-0").enrollmentStatus;
  const batch = await preview("admin", 2026); await commit("admin", batch.batchId);
  assert.equal(users.get("student-0").yearLevel, 2); assert.equal(users.get("student-0").academicHistory[0].yearLevel, 1);
});

test("undo restores advanced, retained, graduated and unanchored students without changing private data or access", async()=>{
  delete users.get('student-0').academicYearStart;
  const batch=await preview('admin',2026);
  await commit('admin',batch.batchId,['student-1'],['student-13']);
  const result=await undo('another-admin',batch.batchId);
  assert.equal(result.status,'undone');assert.equal(result.undo.counts.restored,14);
  for(const student of users.values()){
    assert.equal(student.yearLevel,student._id==='student-13'?4:1);
    assert.equal(student.enrollmentStatus,'active');
    assert.equal(student.academicYearStart,student._id==='student-0'?null:2026);
    assert.equal(student.academicHistory.length,0);
    assert.equal(student.academicTransitions.length,1);
    assert.equal(student.academicTransitions[0].revertedBy,'another-admin');
    assert.ok(student.academicTransitions[0].revertedAt);
    assert.deepEqual(student.faceDescriptor,[0.123]);assert.equal(student.serviceBalance,24);
  }
  assert.equal(users.get('student-3').organizerAccess,true);
  assert.equal((await undo('admin',batch.batchId)).undo.counts.restored,14);
  await assert.rejects(commit('admin',batch.batchId,['student-1'],['student-13']),{status:409});
  const fresh=await preview('admin',2026);
  assert.equal(fresh.students.length,14);
  assert.equal((await commit('admin',fresh.batchId)).counts.advanced,13);
  assert.equal(users.get('student-0').yearLevel,2);
});

test("undo skips later academic edits and newer transitions while reporting each conflict",async()=>{
  const batch=await preview('admin',2026);await commit('admin',batch.batchId);
  users.get('student-0').program='BSCS';users.get('student-1').section='B';users.get('student-2').yearLevel=3;
  users.get('student-3').academicTransitions.push({batch:'newer',toSchoolYear:2028});
  const result=await undo('admin',batch.batchId);
  assert.equal(result.status,'undo_partial');assert.equal(result.undo.counts.skipped,4);assert.equal(result.undo.counts.restored,10);
  assert.equal(users.get('student-0').program,'BSCS');assert.equal(users.get('student-1').section,'B');assert.equal(users.get('student-2').yearLevel,3);
  assert.match(result.undo.issues.find(item=>item.studentId==='student-3').message,/newer academic update/i);
});

test("partial undo can retry failures and never reapplies a batch or changes restored students twice",async()=>{
  const batch=await preview('admin',2026);await commit('admin',batch.batchId);failStudent='student-5';
  const result=await undo('admin',batch.batchId);
  assert.equal(result.status,'undo_partial');assert.equal(result.undo.counts.failed,1);assert.equal(result.undo.counts.restored,13);
  const revertedAt=users.get('student-0').academicTransitions[0].revertedAt;
  failStudent='';const retried=await undo('admin',batch.batchId);
  assert.equal(retried.status,'undone');assert.equal(retried.undo.counts.restored,14);
  assert.deepEqual(users.get('student-0').academicTransitions[0].revertedAt,revertedAt);
});

test("undo handles partial advancement without touching students never updated by the batch",async()=>{
  const batch=await preview('admin',2026);failStudent='student-5';
  assert.equal((await commit('admin',batch.batchId)).status,'partial');failStudent='';
  const result=await undo('admin',batch.batchId);
  assert.equal(result.status,'undone');assert.equal(result.undo.counts.restored,13);assert.equal(result.undo.counts.unaffected,1);
  assert.equal(users.get('student-5').academicTransitions.length,0);
});

test("draft or running updates cannot be undone",async()=>{
  const batch=await preview('admin',2026);
  await assert.rejects(undo('admin',batch.batchId),{status:409});
  batches.get(batch.batchId).status='running';
  await assert.rejects(undo('admin',batch.batchId),{status:409});
});
