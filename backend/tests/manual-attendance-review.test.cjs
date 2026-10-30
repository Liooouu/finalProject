const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createService, buildProposal, canReview } = require('../services/manualAttendance');
const ids = { event:'111111111111111111111111', student:'222222222222222222222222', requester:'333333333333333333333333', admin:'444444444444444444444444', reviewer:'555555555555555555555555', other:'666666666666666666666666' };
const requester = { _id:ids.requester, role:'organizer' }, admin={ _id:ids.admin, role:'admin' }, reviewer={ _id:ids.reviewer, role:'organizer' };
const event = () => ({ _id:ids.event, title:'CCIT event', date:'2026-10-30',time:'08:00',endDate:'2026-10-30',endTime:'12:00',attendanceStartTime:'08:00',attendanceEndTime:'08:30',status:'live',manualAttendanceReviewers:[ids.reviewer] });
const at = clock => new Date(`2026-10-30T${clock}+08:00`);
const payload = () => ({ eventId:ids.event,studentId:ids.student,mode:'checkin',reason:'Camera unavailable',identityChecked:true });
const copy = value => value === undefined ? undefined : structuredClone(value);
function values(object,path) { if(!path.length)return [object];if(Array.isArray(object))return object.flatMap(value=>values(value,path));return values(object?.[path[0]],path.slice(1)); }
function equal(a,b){return a instanceof Date || b instanceof Date ? Number(new Date(a))===Number(new Date(b)) : a===b || String(a)===String(b);}
function matches(row,filter={}) { return Object.entries(filter).every(([key,wanted])=>{
  if(key==='$and')return wanted.every(part=>matches(row,part));if(key==='$or')return wanted.some(part=>matches(row,part));
  const found=values(row,key.split('.'));
  if(wanted && typeof wanted==='object' && !(wanted instanceof Date))return Object.entries(wanted).every(([op,v])=>{
    if(op==='$in')return found.some(x=>Array.isArray(x)?x.some(y=>v.some(z=>equal(y,z))):v.some(y=>equal(x,y)));
    if(op==='$ne')return found.every(x=>!equal(x,v));if(op==='$exists')return found.some(x=>(x!==undefined)===v);
    if(op==='$lte')return found.some(x=>x<=v);if(op==='$regex')return found.some(x=>new RegExp(v,wanted.$options||'').test(x||''));if(op==='$options')return true;
    return false;
  });return found.some(x=>Array.isArray(x)?x.some(y=>equal(y,wanted)):equal(x,wanted));
});}
function setPath(row,key,value){const parts=key.split('.');let target=row;for(const part of parts.slice(0,-1))target=target[part]||=( {} );target[parts.at(-1)]=copy(value);}
function fixture(){
  const data={Request:[],Attendance:[],Event:[event()],User:[{_id:ids.student,role:'student',name:'Student',email:'student@test.invalid'},{...requester,name:'Operator'}, {...reviewer,name:'Reviewer'},admin]};
  let sequence=10, writes=0, failFinalize=false, failNotification=false, blockAttendanceUpdate=false;
  function query(resolve,kind){let paths=[],offset=0,limit=Infinity;const run=()=>{
    let result=copy(resolve());if(Array.isArray(result))result=result.slice(offset,offset+limit);
    const populate=row=>{if(!row)return row;for(const p of paths){const source=p==='event'?data.Event:data.User;const value=row[p];if(value)row[p]=copy(source.find(x=>equal(x._id,value?._id||value))||null);}return row;};
    if(kind==='Request')result=Array.isArray(result)?result.map(populate):populate(result);return result;
  };return { select(){return this},populate(p){paths.push(p);return this},sort(){return this},skip(n){offset=n;return this},limit(n){limit=n;return this},lean(){return Promise.resolve(run())},then(ok,bad){return Promise.resolve(run()).then(ok,bad)} };}
  function model(kind){return {
    findById:id=>query(()=>data[kind].find(row=>equal(row._id,id))||null,kind),
    findOne:filter=>query(()=>data[kind].find(row=>matches(row,filter))||null,kind),
    find:filter=>query(()=>data[kind].filter(row=>matches(row,filter)),kind),
    countDocuments:async filter=>data[kind].filter(row=>matches(row,filter)).length,
    exists:async filter=>data[kind].some(row=>matches(row,filter)),
    create:async input=>{if(kind==='Request'&&data.Request.some(row=>row.status==='pending'&&equal(row.event,input.event)&&equal(row.student,input.student)))throw Object.assign(new Error('duplicate'),{code:11000});if(kind==='Attendance'&&data.Attendance.some(row=>equal(row.event,input.event)&&equal(row.student,input.student)))throw Object.assign(new Error('duplicate'),{code:11000});const row={_id:String(sequence++).padStart(24,'0'),createdAt:new Date(),updatedAt:new Date(),...copy(input)};data[kind].push(row);if(kind==='Attendance')writes++;return copy(row);},
    updateOne:async (filter,update,options={})=>{
      if(kind==='Request'&&update.$set?.status==='approved'&&failFinalize){failFinalize=false;throw Error('connection interrupted');}
      if(kind==='Attendance'&&blockAttendanceUpdate)return {modifiedCount:0};
      let row=data[kind].find(row=>matches(row,filter));if(!row&&options.upsert){row={_id:String(sequence++).padStart(24,'0'),createdAt:new Date(),updatedAt:new Date(),...copy(update.$setOnInsert)};data[kind].push(row);if(kind==='Attendance')writes++;return {modifiedCount:0,upsertedCount:1};}if(!row)return {modifiedCount:0};
      for(const [key,value]of Object.entries(update.$set||{}))setPath(row,key,value);
      for(const key of Object.keys(update.$unset||{}))delete row[key];
      for(const [key,value]of Object.entries(update.$push||{})){row[key]||=[];row[key].push(...copy(value.$each||[value]));}
      for(const [key,value]of Object.entries(update.$inc||{}))row[key]=(row[key]||0)+value;
      if(!update.$setOnInsert)row.updatedAt=new Date();if(kind==='Attendance'&&!update.$setOnInsert)writes++;return {modifiedCount:1};
    },
    findOneAndUpdate(filter,update){const row=data[kind].find(row=>matches(row,filter));if(row)for(const [key,value]of Object.entries(update.$set||{}))setPath(row,key,value);return query(()=>row||null,kind)},
    findByIdAndUpdate(id,update){const row=data[kind].find(row=>equal(row._id,id));if(row)Object.assign(row,copy(update.$set));return query(()=>row||null,kind)},
  };}
  const api=createService({Request:model('Request'),Attendance:model('Attendance'),Event:model('Event'),User:model('User'),notifyUsers:async()=>{if(failNotification)throw Error('SMTP failed')}});
  return {data,api,get writes(){return writes},set failFinalize(v){failFinalize=v},set failNotification(v){failNotification=v},set blockAttendanceUpdate(v){blockAttendanceUpdate=v}};
}
test('server time determines present/late at exact window boundaries',()=>{
  assert.throws(()=>buildProposal(event(),payload(),at('07:59:59')),/not opened/);
  for(const time of ['08:00:00','08:20:00','08:30:00'])assert.equal(buildProposal(event(),payload(),at(time)).proposedStatus,'present');
  assert.equal(buildProposal(event(),payload(),at('08:30:01')).proposedHours,4);
  assert.throws(()=>buildProposal(event(),payload(),at('12:00:01')),/closed/);
});
test('live entry cannot spoof a time, classification, consent, or future attendance',()=>{
  assert.throws(()=>buildProposal(event(),{...payload(),effectiveAt:at('08:10:00').toISOString()},at('08:20:00')),/cannot be backdated/);
  assert.throws(()=>buildProposal(event(),{...payload(),requestedStatus:'present'},at('08:20:00')),/calculated/);
  assert.throws(()=>buildProposal(event(),{...payload(),identityChecked:false},at('08:20:00')),/identity/);
  assert.throws(()=>buildProposal(event(),{...payload(),mode:'correction',effectiveAt:at('09:00:00').toISOString()},at('08:20:00')),/past/);
  assert.throws(()=>buildProposal(event(),{...payload(),mode:'correction',effectiveAt:'2026-10-30T08:20:00'},at('09:00:00')),/time zone/);
});
test('late corrections use the original attendance period and absences use the cutoff',()=>{
  const closed={...event(),status:'finished'};
  assert.equal(buildProposal(closed,{...payload(),mode:'correction',effectiveAt:at('08:20:00').toISOString()},at('22:00:00')).proposedHours,0);
  assert.equal(buildProposal(closed,{...payload(),mode:'correction',requestedStatus:'absent'},at('22:00:00')).effectiveAt.toISOString(),at('12:00:00').toISOString());
  assert.throws(()=>buildProposal(event(),{...payload(),mode:'correction',requestedStatus:'absent'},at('10:00:00')),/after attendance/);
  assert.throws(()=>buildProposal(closed,payload(),at('08:20:00')),/closed/);
});
test('self marking, student/admin submissions, duplicate pending requests are blocked',async()=>{
  const f=fixture();
  await assert.rejects(f.api.submit({...requester,_id:ids.student},payload(),at('08:20:00')),/own attendance/);
  for(const role of ['student','admin'])await assert.rejects(f.api.submit({...requester,role},payload(),at('08:20:00')),/Only event organizers/);
  await f.api.submit(requester,payload(),at('08:20:00'));
  await assert.rejects(f.api.submit(requester,payload(),at('08:21:00')),/already pending/);
  assert.equal(f.writes,0);
});
test('night approval uses captured on-time check-in and reconciles only its auto absence',async()=>{
  const f=fixture();const request=await f.api.submit(requester,payload(),at('08:20:00'));
  f.data.Event[0].status='finished';f.data.Event[0].attendanceEndTime='08:00';
  f.data.Attendance.push({_id:'record',event:ids.event,student:ids.student,status:'absent',method:'auto',communityServiceHours:8,communityServiceLog:[{action:'penalty',hours:8,note:'Marked absent (auto)'}],createdAt:at('12:01:00'),updatedAt:at('12:01:00')});
  f.data.Attendance.push({_id:'unrelated',event:ids.other,student:ids.student,status:'absent',communityServiceHours:8});
  assert.equal((await f.api.reviewOne(admin,request._id,'approved','ID and presence verified',at('22:00:00'))).status,'approved');
  const record=f.data.Attendance[0];assert.equal(record.status,'present');assert.equal(record.communityServiceHours,0);assert.equal(new Date(record.attendedAt).toISOString(),at('08:20:00').toISOString());
  assert.equal(record.manualAttendanceAudit[0].reviewedBy,ids.admin);assert.equal(f.data.Attendance[1].communityServiceHours,8);
});
test('late approval produces four hours regardless of review delay; prior reductions survive corrections',async()=>{
  const f=fixture();f.data.Attendance.push({_id:'record',event:ids.event,student:ids.student,status:'absent',method:'manual',communityServiceHours:6,communityServiceLog:[],updatedAt:at('12:01:00')});
  const request=await f.api.submit(requester,{...payload(),mode:'correction',effectiveAt:at('08:45:00').toISOString()},at('15:00:00'));
  await f.api.reviewOne(admin,request._id,'approved','',at('22:00:00'));
  assert.equal(f.data.Attendance[0].status,'late');assert.equal(f.data.Attendance[0].communityServiceHours,2);
});
test('requester, beneficiary, and unassigned organizer cannot review',async()=>{
  const f=fixture();f.data.Event[0].manualAttendanceReviewers.push(ids.requester,ids.student);
  const request=await f.api.submit(requester,payload(),at('08:20:00'));
  for(const user of [requester,{_id:ids.student,role:'organizer'},{_id:ids.other,role:'organizer'},{_id:ids.other,role:'student'}])await assert.rejects(f.api.reviewOne(user,request._id,'approved','',at('22:00:00')),/independent/);
  assert.equal(canReview(reviewer,f.data.Event[0],f.data.Request[0]),true);
  await f.api.reviewOne(reviewer,request._id,'approved','',at('22:00:00'));assert.equal(f.writes,1);
});
test('delegation revocation immediately prevents review and only admin assigns current organizers',async()=>{
  const f=fixture();const request=await f.api.submit(requester,payload(),at('08:20:00'));
  f.data.Event[0].manualAttendanceReviewers=[];
  await assert.rejects(f.api.reviewOne(reviewer,request._id,'approved','',at('22:00:00')),/independent/);
  await assert.rejects(f.api.assignReviewers(reviewer,{eventId:ids.event,userIds:[ids.requester]}),/Only administrators/);
  await assert.rejects(f.api.assignReviewers(admin,{eventId:ids.event,userIds:[ids.student]}),/current organizer/);
  await f.api.assignReviewers(admin,{eventId:ids.event,userIds:[ids.reviewer]});
  assert.deepEqual(f.data.Event[0].manualAttendanceReviewers,[ids.reviewer]);
});
test('batch review requires independent verification, rejects self items individually and is idempotent',async()=>{
  const f=fixture();const request=await f.api.submit(requester,payload(),at('08:20:00'));
  await assert.rejects(f.api.reviewBatch(admin,{ids:[request._id],decision:'approved'}),/independent verification/);
  const result=await f.api.reviewBatch(admin,{ids:[request._id,'bad'],decision:'approved',verifiedPresence:true});
  assert.deepEqual(result.results.map(row=>row.status),['approved','error']);
  await f.api.reviewBatch(admin,{ids:[request._id],decision:'approved',verifiedPresence:true});assert.equal(f.writes,1);
  assert.equal((await f.api.reviewBatch(admin,{ids:[request._id],decision:'rejected',note:'Not physically present'})).results[0].status,'error');
});
test('rejection creates missing automatic absence after cutoff and preserves existing valid attendance',async()=>{
  const f=fixture();const request=await f.api.submit(requester,payload(),at('08:20:00'));
  await f.api.reviewOne(admin,request._id,'rejected','No independent presence evidence',at('22:00:00'));
  assert.equal(f.data.Attendance[0].status,'absent');assert.equal(f.data.Attendance[0].communityServiceHours,8);
  const g=fixture();const req=await g.api.submit(requester,payload(),at('08:20:00'));
  g.data.Attendance.push({_id:'face',event:ids.event,student:ids.student,status:'present',method:'face',communityServiceHours:0});
  await g.api.reviewOne(admin,req._id,'rejected','Face already recorded',at('22:00:00'));
  assert.equal(g.data.Attendance[0].method,'face');assert.equal(g.data.Attendance[0].communityServiceHours,0);
});
test('later face, excuse or human changes cannot be overwritten',async()=>{
  for(const record of [{status:'present',method:'face',communityServiceHours:0},{status:'excused',method:'manual',communityServiceHours:0},{status:'absent',method:'auto',communityServiceHours:3}]){
    const f=fixture(),request=await f.api.submit(requester,payload(),at('08:20:00'));
    f.data.Attendance.push({_id:'record',event:ids.event,student:ids.student,...record});
    await assert.rejects(f.api.reviewOne(admin,request._id,'approved','',at('22:00:00')),/already controls|changed/);assert.equal(f.writes,0);
  }
});
test('conditional attendance write conflicts rather than overwriting a concurrent edit',async()=>{
  const f=fixture();f.data.Attendance.push({_id:'record',event:ids.event,student:ids.student,status:'absent',method:'manual',communityServiceHours:8,updatedAt:at('12:00:00')});
  const request=await f.api.submit(requester,{...payload(),mode:'correction',effectiveAt:at('08:20:00').toISOString()},at('15:00:00'));f.blockAttendanceUpdate=true;
  await assert.rejects(f.api.reviewOne(admin,request._id,'approved','',at('22:00:00')),/changed during review/);
  assert.equal(f.data.Request[0].status,'pending');assert.equal(f.data.Attendance[0].communityServiceHours,8);
});
test('retry recovers an applied approval without changing hours twice, even if retry asks to reject',async()=>{
  const f=fixture(),request=await f.api.submit(requester,payload(),at('08:45:00'));f.failFinalize=true;
  await assert.rejects(f.api.reviewOne(admin,request._id,'approved','Witnessed attendance',at('22:00:00')),/connection interrupted/);
  assert.equal(f.data.Request[0].status,'pending');assert.equal(f.writes,1);
  assert.equal((await f.api.reviewOne(admin,request._id,'rejected','Retry after lost response',at('22:01:00'))).status,'approved');
  assert.equal(f.data.Request[0].reviewNote,'Witnessed attendance');assert.equal(f.writes,1);assert.equal(f.data.Attendance[0].communityServiceHours,4);
});
test('notification failure does not undo a completed approval',async()=>{
  const f=fixture(),request=await f.api.submit(requester,payload(),at('08:20:00'));f.failNotification=true;
  assert.equal((await f.api.reviewOne(admin,request._id,'approved','',at('22:00:00'))).status,'approved');assert.equal(f.writes,1);
});
test('concurrent reviewers apply a request once and escaped search remains literal',async()=>{
  const f=fixture(),request=await f.api.submit(requester,payload(),at('08:20:00'));
  assert.equal((await f.api.list(admin,{search:'^.*$'})).total,0);
  assert.equal((await f.api.list(admin,{search:'('})).total,0);
  const outcomes=await Promise.allSettled([f.api.reviewOne(admin,request._id,'approved','',at('22:00:00')),f.api.reviewOne(reviewer,request._id,'approved','',at('22:00:00'))]);
  assert.ok(outcomes.some(row=>row.status==='fulfilled'));assert.equal(f.writes,1);assert.equal(f.data.Attendance[0].manualAttendanceAudit.length,1);
});
test('list scopes student data, organizer submissions and delegated review events',async()=>{
  const f=fixture(),request=await f.api.submit(requester,payload(),at('08:20:00'));
  assert.equal((await f.api.list(requester,{view:'mine'})).total,1);
  assert.equal((await f.api.list({...requester,_id:ids.other},{view:'mine'})).total,0);
  assert.equal((await f.api.list({_id:ids.student,role:'student'})).total,1);
  assert.equal((await f.api.list({_id:ids.other,role:'student'})).total,0);
  const review=await f.api.list(reviewer,{view:'review',search:'student@test.invalid'});assert.equal(review.total,1);assert.equal(review.requests[0].canReview,true);assert.equal(review.requests[0].previousAttendance,undefined);
  assert.equal((await f.api.list(requester,{view:'review'})).total,0);
  assert.deepEqual(await f.api.summary(reviewer),{pendingReview:1,pendingMine:0});
  assert.equal((await f.api.pendingManualEventsForStudent(ids.student))[0]._id,request._id);
});
