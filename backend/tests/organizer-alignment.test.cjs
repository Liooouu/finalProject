const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { excuseReviewIssue, excuseReviewerFilter } = require('../services/excuseReview');
const { excuseWindow } = require('../services/excuseWindow');
const organizerId = '111111111111111111111111';
let letter, record, saves, claims, notices, race, listFilter, failNotice, pendingFilter;
const query = value => ({ populate() { return this; }, sort() { return this; }, then(ok, bad) { return Promise.resolve(value).then(ok, bad); } });
const originalLoad = Module._load;
Module._load = function(name, parent, ...rest) {
  const mocks = {
    '../models/Excuse': {
      find: filter => { listFilter = filter; return query([{ ...letter, toObject: () => ({ ...letter }) }]); },
      countDocuments: async filter => { pendingFilter = filter; return 1; },
      findById: () => query(letter),
      findOneAndUpdate: (filter, update) => { claims++; if (race) return query(null); letter.status = update.status; return query({ ...letter, set(key, value) { this[key] = value; }, student: { _id: 'student', name: 'Student' } }); },
      findByIdAndUpdate: async () => {},
    },
    '../models/Event': { find: () => Object.assign(query([{_id:'event'}]), { distinct: async () => ['event'] }) }, '../models/Attendance': { findOne: async () => record, aggregate: async () => [] },
    '../services/fileStore': {}, '../services/notify': { notifyUsers: async (users, notice) => { notices.push(notice); if (failNotice) throw new Error("Email delivery unavailable"); } },
    '../middleware/authMiddleware': { protect: (req, res, next) => next() },
  };
  return mocks[name] || originalLoad.call(this, name, parent, ...rest);
};
const router = require('../routes/organizerRoutes');
Module._load = originalLoad;
beforeEach(() => {
  saves = 0; claims = 0; notices = []; race = false; failNotice = false;
  letter = { _id: 'letter', type: 'absence', student: 'student', event: { _id: 'event', organizer: organizerId, title: 'Service', date: '2026-09-01', endTime: '12:00' }, status: 'pending', attachments: ['/uploads/proof.pdf'], createdAt: new Date('2026-09-02T04:00:00Z') };
  record = { _id: 'attendance', status: 'absent', communityServiceHours: 5, communityServiceLog: [], save: async () => { saves++; } };
});
async function review(body = { status: 'approved', removal: 'complete' }, user = { role: 'organizer', _id: organizerId }) {
  const handler = router.stack.find(layer => layer.route?.path === '/excuses/:id' && layer.route.methods.patch).route.stack.at(-1).handle;
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ user, body, params: { id: 'letter' } }, res);
  return result;
}
test('on-time letters remain reviewable after the submission window closes', async () => {
  assert.equal(excuseReviewIssue(letter, record), '');
  assert.equal((await review()).status, 200);
  assert.equal(record.status, 'excused'); assert.equal(record.communityServiceHours, 0); assert.equal(record.communityServiceLog[0].hours, 5);
  assert.match(notices[0].message, /5 community service hours/); assert.equal(saves, 1);
});
test('approval cannot deduct a flat 16 hours across unrelated events', async () => { const result = await review({ status: 'approved', removal: '16' }); assert.equal(result.status, 400); assert.equal(claims, 0); assert.equal(saves, 0); });
test('legacy advance letters cannot be approved but can be rejected', async () => { letter.type = 'advance'; assert.equal((await review()).status, 400); assert.equal((await review({ status: 'rejected' })).status, 200); assert.equal(saves, 0); });
test('supporting attachments are required for approval', async () => { letter.attachments = []; assert.equal((await review()).status, 400); assert.equal(claims, 0); });
test('legacy single-file attachment remains valid', () => { letter.attachments = []; letter.attachmentUrl = '/uploads/old.pdf'; assert.equal(excuseReviewIssue(letter, record), ''); });
test('submission must follow scheduled end and be within seven days', async () => { for (const at of ['2026-09-01T03:59:59Z', '2026-09-08T04:00:00.001Z']) { letter.createdAt = new Date(at); assert.equal((await review()).status, 400); } assert.equal(saves, 0); });
test('exact end and exact seven-day deadline are inclusive', () => { const window = excuseWindow(letter.event); for (const at of [window.endedAt, window.deadline]) { letter.createdAt = at; assert.equal(excuseReviewIssue(letter, record), ''); } });
test('present, late, excused, pending or missing records cannot be approved', async () => { for (const status of ['present', 'late', 'excused', 'pending', null]) { record = status ? { status } : null; assert.equal((await review()).status, 400); } assert.equal(claims, 0); });
test('organizers can approve letters from events created by another organizer', async () => { assert.equal((await review(undefined, {role:'organizer',_id:'other'})).status,200);assert.equal(saves,1); });
test('ordinary and promoted students in student context cannot review letters', async () => { for(const user of [{role:'student',_id:organizerId},{role:'student',_id:organizerId,organizerAccess:true}])assert.equal((await review(undefined,user)).status,403);assert.equal(claims,0); });
test('promoted student organizers can approve or reject other student organizers across events',async()=>{for(const status of ['approved','rejected']){letter.status='pending';letter.student='another-promoted-student';record.status='absent';const result=await review({status},{role:'organizer',accountRole:'student',_id:'promoted-reviewer'});assert.equal(result.status,200);assert.equal(result.body.canDelete,false);} });
test('organizers cannot approve or reject their own letters regardless of event ownership',async()=>{for(const student of [organizerId,{_id:organizerId}])for(const status of ['approved','rejected']){letter.student=student;const result=await review({status},{role:'organizer',accountRole:'student',_id:organizerId});assert.equal(result.status,403);assert.match(result.body.error,/own excuse/);}assert.equal(claims,0);assert.equal(saves,0);assert.equal(notices.length,0);});
test('admins can approve and reject every student letter independent of event ownership and author identity',async()=>{for(const status of ['approved','rejected']){letter.status='pending';letter.student='admin-reviewer';record.status='absent';assert.equal((await review({status},{role:'admin',_id:'admin-reviewer'})).status,200);}});

test('already-reviewed and concurrent reviews do not change hours twice', async () => { letter.status = 'approved'; assert.equal((await review()).status, 400); letter.status = 'pending'; race = true; assert.equal((await review()).status, 409); assert.equal(saves, 0); });
test('academic calendar endpoint is role protected and preserves preview mode', async () => { const handler = router.stack.find(layer => layer.route?.path === '/academic-calendar').route.stack.at(-1).handle; for (const role of ['student', 'organizer']) { let code = 200, data; const res = { status(c) { code = c; return this; }, json(d) { data = d; } }; handler({ user: { role } }, res); assert.equal(code, role === 'student' ? 403 : 200); if (role === 'organizer') { assert.equal(data.confirmed, false); assert.equal(data.current.semesters.length, 2); } } });

test('excuse queue spans events and exposes individual review permissions and submission policy', async () => {
  const handler = router.stack.find(layer => layer.route?.path === '/excuses' && layer.route.methods.get).route.stack.at(-1).handle;
  let data, code = 200;
  const res = { status(c) { code = c; return this; }, json(d) { data = d; return this; } };
  await handler({ user: { role: 'organizer', _id: organizerId } }, res);
  assert.equal(code, 200); assert.deepEqual(listFilter, {});
  assert.equal(data[0].approvalIssue, ''); assert.equal(new Date(data[0].submissionDeadline).toISOString(), '2026-09-08T04:00:00.000Z');
  letter.type = 'advance'; await handler({ user: { role: 'organizer', _id: organizerId } }, res); assert.match(data[0].approvalIssue, /Advance/);
});

test('notification delivery failure does not undo an approved absence', async () => { failNotice = true; const result = await review(); assert.equal(result.status, 200); assert.equal(result.body.status, 'approved'); assert.equal(record.status, 'excused'); assert.equal(record.communityServiceHours, 0); assert.match(result.body.notificationWarning, /Review saved/); });

test('a reviewer cannot approve a version older than the student resubmission',async()=>{letter.submissionVersion=2;const result=await review({status:'approved',expectedVersion:1});assert.equal(result.status,409);assert.equal(claims,0);assert.equal(saves,0);});

test('admin queue includes all letters and organizer pending badge excludes only own letters',async()=>{for(const role of ['organizer','admin']){let result;const req={user:{role,_id:organizerId}};const res={status(){return this;},json(data){result=data;}};const queue=router.stack.find(l=>l.route?.path==='/excuses'&&l.route.methods.get).route.stack.at(-1).handle;await queue(req,res);assert.deepEqual(listFilter,{});const stats=router.stack.find(l=>l.route?.path==='/stats').route.stack.at(-1).handle;await stats(req,res);assert.equal(result.pendingExcuses,1);assert.deepEqual(pendingFilter,role==='admin'?{status:'pending'}:{student:{$ne:organizerId},status:'pending'});}});
test('new and resubmitted letters notify admins and both organizer identities but exclude their author',()=>{assert.deepEqual(excuseReviewerFilter('author'),{$or:[{role:'admin'},{role:'organizer'},{role:'student',organizerAccess:true}],_id:{$ne:'author'}});});

test('own pending letters stay visible with review disabled while admins retain review access',async()=>{letter.student=organizerId;const handler=router.stack.find(l=>l.route?.path==='/excuses'&&l.route.methods.get).route.stack.at(-1).handle;for(const role of ['organizer','admin']){let data;await handler({user:{role,_id:organizerId}},{status(){return this},json(value){data=value}});assert.equal(data.length,1);assert.equal(data[0].student,organizerId);assert.equal(data[0].canReview,role==='admin');assert.equal(data[0].status,'pending');}});
