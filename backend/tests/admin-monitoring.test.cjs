const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const owner = '111111111111111111111111', eventId = '222222222222222222222222', studentId = '333333333333333333333333';
let event, attendanceWrites, eventWrites, stationWrites, stored, creatorRole, notificationOptions, failEventNotification;
const query = value => ({ populate() { return this; }, select() { return this; }, sort() { return this; }, lean: async () => value, then(ok, bad) { return Promise.resolve(value).then(ok, bad); } });
class FakeEvent { constructor(data) { Object.assign(this, data, { _id: eventId }); } async save() { eventWrites++; } }
FakeEvent.findById = async () => event;
FakeEvent.findOne = async () => null;
FakeEvent.findByIdAndUpdate = (id, update) => { eventWrites++; for (const [key,value] of Object.entries(update)) if (value !== undefined) event[key] = value; return query(event); };
class FakeAttendance { constructor(data) { Object.assign(this, data, { _id: 'record' }); } async save() { attendanceWrites++; stored = this; } }
FakeAttendance.findOne = async () => stored;
FakeAttendance.findById = () => query(stored);
FakeAttendance.find = () => query([{ _id: 'existing', status: 'present', student: { name: 'Student' } }]);
const originalLoad = Module._load;
Module._load = function(name, parent, ...rest) {
 const mocks = {
  '../models/Event': FakeEvent, '../models/Attendance': FakeAttendance,
  '../models/User': { findById: id => query(id === studentId ? { _id: studentId, role: 'student' } : { role: creatorRole }) },
  '../models/Excuse': {}, '../models/Notification': {},
  '../models/CheckInSession': { create: async data => { stationWrites++; return { ...data, _id: 'session' }; } },
  '../services/notify': { notifyUsers: async (recipients,options) => {notificationOptions=options;if(failEventNotification)throw Error('Storage unavailable');}, eventRecipients: async () => [] },
  '../services/fileStore': {}, '../services/faceIdentify': {},
  '../middleware/authMiddleware': { protect: (req, res, next) => next() },
 };
 return mocks[name] || originalLoad.call(this, name, parent, ...rest);
};
const access = require('../services/eventAccess');
const events = require('../routes/eventRoutes');
const checkin = require('../routes/checkinRoutes');
Module._load = originalLoad;
beforeEach(() => { attendanceWrites = 0; eventWrites = 0; stationWrites = 0; stored = null; notificationOptions=null;failEventNotification=false; creatorRole = 'admin'; event = { _id: eventId, organizer: owner, title: 'Original title', date: '2027-01-01', time: '09:00', endDate: '2027-01-01', endTime: '12:00', attendanceStartTime: '08:00', attendanceEndTime: '09:30', status: 'upcoming' }; });
async function call(router, path, method, role, body = {}, id = owner) {
 const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
 const result = { status: 200 }; const res = { status(code) { result.status = code; return this; }, json(data) { result.body = data; return this; } };
 await handler({ user: { _id: id, role, name: role === "admin" ? "Review Admin" : "Review Organizer" }, params: { id: eventId, studentId }, body, query: {} }, res); return result;
}
for (const [path,method] of [['/:id/attendees/manual','post'],['/:id/attendees/:studentId','patch'],['/:id/attendees/:studentId/community-service','patch'],['/:id/attendees/:studentId/community-service/remove','patch']]) test(`admin cannot write attendance through ${method} ${path}`, async () => { const result = await call(events,path,method,'admin',{studentId,status:'present',hours:0});assert.equal(result.status,403);assert.equal(attendanceWrites,0); });
test('admin cannot create a face station even for an event they created', async () => { assert.equal((await call(checkin,'/sessions','post','admin',{eventId})).status,403);assert.equal(stationWrites,0); });
test('admin retains read-only attendance monitoring', async () => { const result = await call(events,'/:id/attendees','get','admin');assert.equal(result.status,200);assert.equal(result.body[0].status,'present');assert.equal(attendanceWrites,0); });
test('admin can create an event for organizers to operate', async () => { const result = await call(events,'/','post','admin',{title:'New event',date:'2027-01-01',time:'09:00',endTime:'12:00',attendanceStartTime:'08:00',attendanceEndTime:'09:30',location:'Auditorium'});assert.equal(result.status,201);assert.equal(eventWrites,1);assert.equal(attendanceWrites,0); });
test('admin can correct information on another organizer event', async () => { event.organizer='444444444444444444444444';const result=await call(events,'/:id','put','admin',{title:'Corrected title',location:'Corrected venue'});assert.equal(result.status,200);assert.equal(result.body.title,'Corrected title');assert.equal(result.body.location,'Corrected venue');assert.equal(attendanceWrites,0); });
test('organizer can still manually record attendance on their own event', async () => { const result=await call(events,'/:id/attendees/manual','post','organizer',{studentId,status:'late'});assert.equal(result.status,201);assert.equal(stored.status,'late');assert.equal(stored.communityServiceHours,4);assert.equal(attendanceWrites,1); });
test('organizers can take attendance on administrator-created events', async () => { assert.equal(await access.canRecordAttendance(event,{role:'organizer',_id:'555555555555555555555555'}),true);assert.equal(await access.canRecordAttendance(event,{role:'admin',_id:owner}),false); });
test('organizers cannot take attendance on unrelated organizer events', async () => { creatorRole='organizer';assert.equal(await access.canRecordAttendance(event,{role:'organizer',_id:'555555555555555555555555'}),false); });
test('organizer can open their event face station', async () => { const result=await call(checkin,'/sessions','post','organizer',{eventId});assert.equal(result.status,201);assert.equal(stationWrites,1); });

test('organizer can edit another organizer event and the server records the actual editor',async()=>{
 creatorRole='organizer';const another='555555555555555555555555';
 const result=await call(events,'/:id','put','organizer',{title:'Shared correction',location:'Updated room',lastEditedBy:owner,lastEditedByName:'Spoofed name',lastEditedAt:'2000-01-01',organizer:another},another);
 assert.equal(result.status,200);assert.equal(event.title,'Shared correction');assert.equal(event.organizer,owner);assert.equal(event.lastEditedBy,another);assert.equal(event.lastEditedByName,'Review Organizer');assert.ok(event.lastEditedAt instanceof Date);assert.equal(attendanceWrites,0);
 assert.equal(await access.canRecordAttendance(event,{role:'organizer',_id:another}),false);
 assert.equal(access.canManageEvent(event,{role:'organizer',_id:another}),false);
});
test('latest editor changes when a different staff member corrects an event',async()=>{
 await call(events,'/:id','put','organizer',{location:'First room'},'555555555555555555555555');
 await call(events,'/:id','put','admin',{location:'Final room'},'666666666666666666666666');
 assert.equal(event.lastEditedBy,'666666666666666666666666');assert.equal(event.lastEditedByName,'Review Admin');assert.equal(event.location,'Final room');assert.equal(event.organizer,owner);
});
test('shared event status and automation edits also record the editor',async()=>{
 creatorRole='organizer';const another='555555555555555555555555';
 assert.equal((await call(events,'/:id/status','patch','organizer',{status:'closed'},another)).status,200);assert.equal(event.lastEditedBy,another);
 assert.equal((await call(events,'/:id/automation','patch','organizer',{enabled:true},another)).status,200);assert.equal(event.lastEditedByName,'Review Organizer');
});
test('students cannot edit shared events or set edit attribution',async()=>{
 const result=await call(events,'/:id','put','student',{title:'Denied'});assert.equal(result.status,403);assert.equal(eventWrites,0);assert.equal(event.lastEditedBy,undefined);
});
test('past events remain available to organizers including other organizers events',async()=>{
 event.status='finished';creatorRole='organizer';assert.equal(access.canEditEvent(event,{role:'organizer',_id:'555555555555555555555555'}),true);
 const result=await call(events,'/:id','put','organizer',{description:'Corrected past event description'},'555555555555555555555555');assert.equal(result.status,200);assert.equal(event.status,'finished');assert.equal(event.description,'Corrected past event description');
});

test('event creation defers SMTP for both organizer and admin',async()=>{for(const role of ['organizer','admin']){const r=await call(events,'/','post',role,{title:'Fast '+role,date:'2027-01-01',time:'09:00',endTime:'12:00',attendanceStartTime:'08:00',attendanceEndTime:'09:30',location:'Hall'});assert.equal(r.status,201);assert.equal(notificationOptions.deferEmail,true);}});
test('saved event still returns success with a warning if notification storage fails',async()=>{failEventNotification=true;const r=await call(events,'/','post','organizer',{title:'Saved even if notification fails',date:'2027-01-01',time:'09:00',endTime:'12:00',attendanceStartTime:'08:00',attendanceEndTime:'09:30',location:'Hall'});assert.equal(r.status,201);assert.equal(eventWrites,1);assert.match(r.body.notificationWarning,/Event saved/);});
