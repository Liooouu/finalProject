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
const { preview, commit, undo, undoPreview, details, studentOptions, listClasses, sourceYearIssue, isEligible } = require("../services/academicAdvancement");
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
  for (const year of [2025, 2101, "2026", 2026.5]) assert.ok(sourceYearIssue(year, now));
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

test("class choices distinguish program, year and section and never advance students",async()=>{
 users.get('student-1').section='B';users.get('student-2').program='BSCS';
 users.set('graduated',{...copy(users.get('student-0')),_id:'graduated',enrollmentStatus:'graduated'});
 users.set('other-year',{...copy(users.get('student-0')),_id:'other-year',academicYearStart:2027});
 const before=copy([...users.values()]);
 const classes=await listClasses(2026);
 assert.deepEqual(classes.map(c=>[c.key,c.count]),[['BSCS:1:A',1],['BSIT:1:A',11],['BSIT:1:B',1],['BSIT:4:A',1]]);
 assert.deepEqual([...users.values()],before);assert.equal(batches.size,0);
});

test("admin student finder includes eligible students across programs without private account fields",async()=>{
 users.get('student-1').program='BSEMC';users.get('student-1').yearLevel=3;
 users.get('student-2').program='BSCS';users.get('student-3').section='C';
 users.get('student-4').academicYearStart=2027;users.get('student-5').enrollmentStatus='graduated';
 const before=copy([...users.values()]);const options=await studentOptions(2026);
 assert.equal(options.students.length,12);assert.equal(options.classes.some(c=>c.program==='BSEMC'&&c.yearLevel===3),true);
 assert.deepEqual(options.students.find(s=>s._id==='student-1'),{_id:'student-1',name:'Student 1',email:'student1@example.test',program:'BSEMC',yearLevel:3,section:'A'});
 assert.equal(options.students.some(s=>['student-4','student-5'].includes(s._id)),false);
 assert.equal(options.students.some(s=>'faceDescriptor'in s||'academicTransitions'in s||'serviceBalance'in s),false);
 assert.equal(batches.size,0);assert.deepEqual([...users.values()],before);
});

test("a class batch advances every page only in that class and undo leaves other classes alone",async()=>{
 users.get('student-1').section='B';users.get('student-2').program='BSCS';
 const scope={program:'BSIT',yearLevel:1,section:'A'};
 const batch=await preview('admin',2026,scope);
 assert.deepEqual(batch.classScope,scope);assert.equal(batch.students.length,11);
 assert.equal(batch.students.some(s=>s._id==='student-3'),true);
 const foreign=copy([users.get('student-1'),users.get('student-2'),users.get('student-13')]);
 await assert.rejects(commit('admin',batch.batchId,['student-1'],[]),{status:400});
 const result=await commit('admin',batch.batchId,['student-11']);
 assert.deepEqual(result.classScope,scope);assert.equal(result.counts.advanced,10);assert.equal(result.counts.retained,1);
 assert.deepEqual([users.get('student-1'),users.get('student-2'),users.get('student-13')],foreign);
 const second=await preview('admin',2026,{program:'BSIT',yearLevel:1,section:'B'});await commit('admin',second.batchId);
 const otherClassAfter=copy(users.get('student-1'));
 const undone=await undo('admin',batch.batchId);assert.equal(undone.undo.counts.restored,11);
 assert.equal(users.get('student-0').yearLevel,1);assert.deepEqual(users.get('student-1'),otherClassAfter);
});

test("malformed class choices cannot create a broad batch; stale class changes are skipped",async()=>{
 for(const scope of [{},{program:'BSIT'},{program:'OTHER',yearLevel:1,section:'A'},{program:'BSIT',yearLevel:1.5,section:'A'},{program:'BSIT',yearLevel:1,section:'D'},[]]) {
  await assert.rejects(preview('admin',2026,scope),{status:400});assert.equal(batches.size,0);
 }
 const batch=await preview('admin',2026,{program:'BSIT',yearLevel:1,section:'A'});
 users.get('student-5').section='B';
 const result=await commit('admin',batch.batchId);assert.equal(result.counts.skipped,1);
 assert.equal(users.get('student-5').yearLevel,1);assert.equal(users.get('student-5').section,'B');
 assert.equal(users.get('student-5').academicTransitions.length,0);
});

test("a fourth-year class retains everyone unless graduation is explicitly chosen",async()=>{
 const batch=await preview('admin',2026,{program:'BSIT',yearLevel:4,section:'A'});
 assert.equal(batch.students.length,1);
 const result=await commit('admin',batch.batchId,[],[]);assert.equal(result.counts.retained,1);assert.equal(result.counts.graduated,0);
 assert.equal(users.get('student-13').enrollmentStatus,'active');assert.equal(users.get('student-0').academicYearStart,2026);
});

test("saved student results survive advancement, later edits and missing live accounts",async()=>{
 const batch=await preview('admin',2026,{program:'BSIT',yearLevel:1,section:'A'});
 await assert.rejects(details(batch.batchId),{status:404});
 await commit('admin',batch.batchId,['student-11']);
 users.get('student-1').name='Changed later';users.get('student-1').yearLevel=4;users.delete('student-0');
 const first=await details(batch.batchId);
 assert.equal(first.students.length,5);assert.equal(first.total,13);assert.equal(first.batchSize,13);
 assert.equal(first.students[0].name,'Student 0');assert.equal(first.students[0].previousYearLevel,1);assert.equal(first.students[0].updatedYearLevel,2);
 assert.equal(first.students[1].name,'Student 1');assert.equal(first.students[1].updatedYearLevel,2);
 const retained=await details(batch.batchId,{search:'STUDENT11@EXAMPLE.TEST'});
 assert.equal(retained.total,1);assert.equal(retained.students[0].outcome,'retained');assert.equal(retained.students[0].updatedYearLevel,1);
 const last=await details(batch.batchId,{page:99});assert.equal(last.page,3);assert.equal(last.students.length,3);
 assert.equal((await details(batch.batchId,{search:'not found'})).total,0);
 await assert.rejects(details('missing'),{status:404});
});

test("failed/skipped results do not claim a new year and undo leaves the original update visible",async()=>{
 const batch=await preview('admin',2026,{program:'BSIT',yearLevel:1,section:'A'});
 users.get('student-6').section='B';failStudent='student-5';
 await commit('admin',batch.batchId);
 for(const id of ['5','6']){
  const report=await details(batch.batchId,{search:`student${id}@example.test`});
  assert.equal(report.students[0].updatedYearLevel,null);assert.equal(report.students[0].outcome,id==='5'?'failed':'skipped');
 }
 failStudent='';await undo('admin',batch.batchId);
 const restored=await details(batch.batchId,{search:'student0@example.test'});
 assert.equal(restored.students[0].updatedYearLevel,2);assert.equal(restored.students[0].previousYearLevel,1);
 assert.equal(restored.students[0].undoOutcome,'restored');assert.equal(restored.batch.status,'undone');
 assert.equal(users.get('student-0').yearLevel,1);
});

test("unfinished previous-year restoration requires reviewed recovery and remains retryable",async()=>{
 delete users.get('student-0').academicYearStart;
 const batch=await preview('admin',2026);await commit('admin',batch.batchId,[],['student-13']);
 users.get('student-0').yearLevel=1;users.get('student-1').yearLevel=1;users.get('student-13').enrollmentStatus='active';
 for(const item of users.get('student-0').academicHistory)delete item.batch;
 const before=copy([...users.values()]);const plan=await undoPreview(batch.batchId);
 assert.deepEqual(plan.reconciliation.map(s=>s.studentId),['student-0','student-1','student-13']);assert.deepEqual([...users.values()],before);
 const incomplete=await undo('admin',batch.batchId);assert.equal(incomplete.status,'undo_partial');assert.equal(incomplete.undo.counts.skipped,3);assert.equal(incomplete.undoneAt,null);
 assert.match(incomplete.undo.issues[0].message,/school-year rollback is unfinished/);
 await assert.rejects(undo('admin',batch.batchId,['foreign']),{status:400});
 const recovered=await undo('admin',batch.batchId,plan.reconciliation.map(s=>s.studentId));
 assert.equal(recovered.status,'undone');assert.equal(recovered.undo.counts.restored,14);assert.ok(recovered.undoneAt);
 assert.equal(users.get('student-0').academicYearStart,null);assert.equal(users.get('student-0').yearLevel,1);
 assert.equal(users.get('student-0').academicHistory.length,1);assert.equal(users.get('student-13').enrollmentStatus,'active');
 assert.ok(users.get('student-0').academicTransitions[0].revertedAt);
 assert.equal((await preview('admin',2026)).students.length,14);
 assert.equal((await undo('admin',batch.batchId)).undo.counts.restored,14);
});

test("recovery never forces a changed class or a newer transition after review",async()=>{
 const batch=await preview('admin',2026);await commit('admin',batch.batchId);
 users.get('student-0').yearLevel=1;users.get('student-1').yearLevel=1;
 const plan=await undoPreview(batch.batchId);assert.equal(plan.reconciliation.length,2);
 users.get('student-0').section='B';users.get('student-1').academicTransitions.push({batch:'newer',toSchoolYear:2028});
 const result=await undo('admin',batch.batchId,plan.reconciliation.map(s=>s.studentId));
 assert.equal(result.undo.counts.skipped,2);assert.equal(users.get('student-0').section,'B');assert.equal(users.get('student-0').academicYearStart,2027);
 assert.equal(users.get('student-1').academicTransitions[0].revertedAt,undefined);assert.equal(result.undoneAt,null);
});

test("positive selection changes only checked students and leaves unchecked academic standing untouched",async()=>{
 const batch=await preview('admin',2026,null,true);const untouched=copy(users.get('student-1'));
 await assert.rejects(commit('admin',batch.batchId),{status:400});
 await assert.rejects(commit('admin',batch.batchId,[],[],[]),{status:400});
 const result=await commit('admin',batch.batchId,[],[],['student-0','student-11']);
 assert.equal(result.counts.advanced,2);assert.equal(result.unchangedCount,12);
 assert.deepEqual(users.get('student-1'),untouched);assert.equal(users.get('student-13').academicYearStart,2026);
 await assert.rejects(commit('admin',batch.batchId,[],[],['student-0']),{status:409});
 assert.equal((await preview('admin',2026)).students.length,12);
 assert.equal((await undo('admin',batch.batchId)).undo.counts.restored,2);
 assert.deepEqual(users.get('student-1'),untouched);
});

test("check-all selection can graduate fourth years only with explicit graduation IDs",async()=>{
 const batch=await preview('admin',2026);const ids=batch.students.map(student=>student._id);
 await assert.rejects(commit('admin',batch.batchId,[],[],ids),{status:400});
 const result=await commit('admin',batch.batchId,[],['student-13'],ids);
 assert.equal(result.counts.advanced,13);assert.equal(result.counts.graduated,1);assert.equal(result.unchangedCount,0);
});
