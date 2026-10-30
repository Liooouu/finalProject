const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'promotion-test-secret-not-used-outside-tests';
const adminId='111111111111111111111111', studentId='222222222222222222222222', otherId='333333333333333333333333';
let users, notifications, failNotification, createdAccounts, closedStations, attendanceRecords, removedReviewerAssignments, pendingManualBlock;
const passwordHash=bcrypt.hashSync('StrongPass123!',4);
function document(value) {
 const result={...value};
 Object.defineProperties(result,{
  toObject:{value(){return {...this};}},
  comparePassword:{value:async function(password){return bcrypt.compare(password,this.password);}},
  save:{value:async function(){users.set(String(this._id),{...this});return this;}},
 });return result;
}
function projection(value,fields) {
 if(value===null||value===undefined)return null;
 const keys=(fields||'').split(/\s+/).filter(Boolean);const source={...value};
 if(keys.length&&keys.every(key=>!key.startsWith('-'))){const selected={_id:source._id};for(const key of keys)if(key in source)selected[key]=source[key];return document(selected);}
 for(const key of keys)if(key.startsWith('-'))delete source[key.slice(1)];return document(source);
}
function query(value) {let fields;return {select(value){fields=value;return this;},sort(){return this;},populate(){return this;},lean(){return Promise.resolve(Array.isArray(value)?value.map(v=>({...projection(v,fields)})):projection(value,fields));},then(ok,bad){return Promise.resolve(Array.isArray(value)?value.map(v=>projection(v,fields)):projection(value,fields)).then(ok,bad);}};}
const userMock={
 normalizeEmail:value=>String(value||'').trim().toLowerCase(),
 findById:id=>query(users.get(String(id))),
 findOne:filter=>query([...users.values()].find(user=>user.email===filter.email)||null),
 find:filter=>query([...users.values()].filter(user=>(!filter.role||user.role===filter.role)&&(!(filter.organizerAccess?.$ne===true)||user.organizerAccess!==true))),
 findOneAndUpdate:(filter,update)=>{const existing=users.get(String(filter._id));if(!existing||existing.role!==filter.role||(filter.organizerAccess===true ? existing.organizerAccess!==true : existing.organizerAccess===true))return query(null);Object.assign(existing,update.$set);for(const [key,amount] of Object.entries(update.$inc||{}))existing[key]=(existing[key]||0)+amount;return query(existing);},
 create:async()=>{createdAccounts++;throw new Error('Promotion must not create accounts');},
};
const originalLoad=Module._load;
Module._load=function(name,parent,...rest){
 const mocks={
  '../models/User':userMock,
  '../models/Event':{updateMany:async(filter,update)=>{removedReviewerAssignments.push({filter,update});}},
  '../models/ManualAttendanceRequest':{exists:async()=>pendingManualBlock},
  '../models/CheckInSession':{updateMany:async(filter,update)=>{closedStations.push({filter,update});}},'../models/Attendance':{find:filter=>({sort:async()=>attendanceRecords.filter(record=>record.student===String(filter.student)).sort((a,b)=>a.attendedAt-b.attendedAt)})},'../models/Excuse':{},'../models/Notification':{},'../models/FaceAppeal':{find:filter=>query([{_id:'own-appeal',student:String(filter.student),status:'pending',note:'My face verification request'}])},
  '../services/notify':{notifyUsers:async(recipients,notice)=>{if(failNotification)throw new Error('Mail unavailable');notifications.push(notice);}},
  '../services/mailer':{isMailEnabled:async()=>false,sendMail:async()=>true,resetTransporter:()=>{}},
  '../services/academicProgression':{syncStudentAcademicYear:async user=>user},
  '../services/fileStore':{},'../services/faceMatcher':{},'../services/faceIdentify':{remove:()=>{}},
 };
 return mocks[name]||originalLoad.call(this,name,parent,...rest);
};
const {protect,authorize}=require('../middleware/authMiddleware');
const adminRouter=require('../routes/adminRoutes');
const authRouter=require('../routes/authRoutes');
const accountRouter=require('../routes/accountRoutes');
const studentRouter=require('../routes/studentRoutes');
const {availableRoles}=require('../services/accountRoles');
Module._load=originalLoad;
const app=express();app.use(express.json());app.use('/admin',adminRouter);app.use('/auth',authRouter);app.use('/account',accountRouter);app.use('/student',studentRouter);
app.get('/student-ledger',protect,authorize('student'),(req,res)=>res.json({student:req.user._id,balance:12,records:['attendance-1','attendance-2']}));
app.get('/organizer-desk',protect,authorize('organizer'),(req,res)=>res.json({id:req.user._id,role:req.user.role}));
let server,origin;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
beforeEach(()=>{
 notifications=[];failNotification=false;createdAccounts=0;closedStations=[];attendanceRecords=[];removedReviewerAssignments=[];pendingManualBlock=false;
 users=new Map([
  [adminId,{_id:adminId,name:'Admin',email:'admin@example.test',role:'admin',password:passwordHash}],
  [studentId,{_id:studentId,name:'Student Officer',email:'officer@example.test',role:'student',organizerAccess:false,password:passwordHash,emailVerified:true,program:'BSIT',yearLevel:3,section:'A',enrollmentStatus:'active',academicYearStart:2026,academicHistory:[{schoolYearStart:2025,yearLevel:2}],facePhoto:'/uploads/enrolled.jpg',faceEnrolledAt:new Date(),faceConsentAt:new Date(),faceDescriptor:Array(128).fill(0),faceEnrollmentVersion:2}],
  [otherId,{_id:otherId,name:'Other Student',email:'other@example.test',role:'student',organizerAccess:false,password:passwordHash}],
 ]);
});
const token=(id,role)=>jwt.sign({id,role},process.env.JWT_SECRET,{expiresIn:'1h'});
async function request(path,{method='GET',body,auth}={}){const response=await fetch(origin+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(auth?{authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
const promote=(id=studentId,auth=token(adminId,'admin'))=>request(`/admin/users/${id}/promote-organizer`,{method:'POST',auth});

test('accounts with pending manual requests cannot be deleted and leave orphaned attendance claims',async()=>{
 pendingManualBlock=true;
 const result=await request(`/admin/users/${studentId}`,{method:'DELETE',auth:token(adminId,'admin')});
 assert.equal(result.status,409);assert.match(result.data.message,/pending manual attendance/);assert.ok(users.has(studentId));
});
test('demotion removes event reviewer assignments so a later promotion does not restore old review authority',async()=>{
 await promote();
 const result=await request(`/admin/users/${studentId}/demote-organizer`,{method:'POST',auth:token(adminId,'admin')});
 assert.equal(result.status,200);assert.equal(removedReviewerAssignments.length,1);
 assert.equal(String(removedReviewerAssignments[0].update.$pull.manualAttendanceReviewers),studentId);
});
test('admin promotion preserves student identity, credentials, face and academic history',async()=>{
 const before={...users.get(studentId)};const response=await promote();assert.equal(response.status,200);const after=users.get(studentId);
 for(const field of ['_id','name','email','password','role','facePhoto','faceDescriptor','faceEnrollmentVersion','academicYearStart','academicHistory','program','yearLevel','section'])assert.deepEqual(after[field],before[field],field);
 assert.equal(after.organizerAccess,true);assert.equal(String(after.organizerPromotedBy),adminId);assert.ok(after.organizerPromotedAt instanceof Date);assert.deepEqual(response.data.student.availableRoles,['student','organizer']);assert.equal(response.data.student.password,undefined);assert.equal(response.data.student.faceDescriptor,undefined);assert.equal(users.size,3);assert.equal(createdAccounts,0);
});
test('candidate list excludes staff and already-promoted students and credential fields',async()=>{await promote();const response=await request('/admin/organizer-candidates',{auth:token(adminId,'admin')});assert.equal(response.status,200);assert.deepEqual(response.data.map(user=>user._id),[otherId]);assert.equal(response.data[0].password,undefined);});
test('students and organizers cannot promote themselves or another account',async()=>{for(const role of ['student','organizer']){users.get(otherId).role=role;const response=await promote(studentId,token(otherId,role));assert.equal(response.status,403);}assert.equal(users.get(studentId).organizerAccess,false);});
test('duplicate and concurrent promotions grant access only once',async()=>{const responses=await Promise.all([promote(),promote()]);assert.deepEqual(responses.map(result=>result.status).sort(),[200,409]);assert.equal(notifications.length,1);assert.equal((await promote()).status,409);});
test('invalid, missing and non-student accounts cannot be promoted',async()=>{assert.equal((await promote('invalid')).status,400);assert.equal((await promote('999999999999999999999999')).status,404);assert.equal((await promote(adminId)).status,400);});
test('old create-organizer endpoint cannot create accounts',async()=>{const response=await request('/admin/create-organizer',{method:'POST',auth:token(adminId,'admin'),body:{name:'New',email:'new@example.test',password:'StrongPass123!'}});assert.equal(response.status,410);assert.equal(createdAccounts,0);});
test('same password logs in with student identity and organizer access after promotion',async()=>{await promote();const response=await request('/auth/login',{method:'POST',body:{email:'officer@example.test',password:'StrongPass123!'}});assert.equal(response.status,200);assert.equal(response.data.role,'student');assert.deepEqual(response.data.availableRoles,['student','organizer']);assert.equal(response.data.requiresFaceEnrollment,false);assert.equal(jwt.verify(response.data.token,process.env.JWT_SECRET).id,studentId);});
test('existing student session keeps personal ledger access after promotion',async()=>{const auth=token(studentId,'student');await promote();const response=await request('/student-ledger',{auth});assert.equal(response.status,200);assert.equal(response.data.balance,12);assert.equal(response.data.student,studentId);});
test('promoted student can switch to organizer and back without changing database role',async()=>{
 await promote();const original=token(studentId,'student');const switched=await request('/auth/switch-role',{method:'POST',auth:original,body:{role:'organizer'}});assert.equal(switched.status,200);const claim=jwt.verify(switched.data.token,process.env.JWT_SECRET);assert.equal(claim.role,'organizer');assert.equal(claim.id,studentId);assert.equal((await request('/organizer-desk',{auth:switched.data.token})).status,200);
 assert.equal((await request('/student-ledger',{auth:switched.data.token})).status,403);
 const profile=await request('/account',{auth:switched.data.token});assert.equal(profile.status,200);assert.equal(profile.data.role,'organizer');assert.equal(profile.data.accountRole,'student');assert.equal(profile.data.facePhoto,'/uploads/enrolled.jpg');assert.deepEqual(profile.data.availableRoles,['student','organizer']);assert.equal(users.get(studentId).role,'student');
 const back=await request('/auth/switch-role',{method:'POST',auth:switched.data.token,body:{role:'student'}});assert.equal(back.status,200);assert.equal((await request('/student-ledger',{auth:back.data.token})).status,200);assert.equal(users.get(studentId).role,'student');
});
test('ordinary students cannot request organizer/admin portal tokens',async()=>{for(const role of ['organizer','admin']){const response=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role}});assert.equal(response.status,403);}});
test('even a signed elevated role claim requires a current database grant',async()=>{assert.equal((await request('/organizer-desk',{auth:token(studentId,'organizer')})).status,401);assert.equal((await request('/organizer-desk',{auth:token(studentId,'admin')})).status,401);});
test('removing a grant invalidates old organizer tokens but preserves student tokens',async()=>{await promote();const switched=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}});users.get(studentId).organizerAccess=false;assert.equal((await request('/organizer-desk',{auth:switched.data.token})).status,401);assert.equal((await request('/student-ledger',{auth:token(studentId,'student')})).status,200);});
test('notification failure does not undo the grant',async()=>{failNotification=true;const response=await promote();assert.equal(response.status,200);assert.equal(users.get(studentId).organizerAccess,true);assert.match(response.data.notificationWarning,/notification/);});
test('legacy organizers and admins retain their single-role permissions',async()=>{assert.deepEqual(availableRoles({role:'organizer'}),['organizer']);assert.deepEqual(availableRoles({role:'admin'}),['admin']);});

test('generic role editing cannot replace a student account with an organizer identity',async()=>{const response=await request(`/admin/users/${studentId}`,{method:'PATCH',auth:token(adminId,'admin'),body:{role:'organizer'}});assert.equal(response.status,400);assert.equal(users.get(studentId).role,'student');assert.equal(users.get(studentId).organizerAccess,false);});
test('switch-role cannot select another promoted account or grant admin access',async()=>{await promote();const denied=await request('/auth/switch-role',{method:'POST',auth:token(otherId,'student'),body:{role:'organizer',userId:studentId}});assert.equal(denied.status,403);const adminDenied=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'admin'}});assert.equal(adminDenied.status,403);});

const demote=(id=studentId,auth=token(adminId,'admin'))=>request(`/admin/users/${id}/demote-organizer`,{method:'POST',auth});
test('demotion preserves student identity and records and closes face stations',async()=>{
 await promote();const before={...users.get(studentId)};const switched=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}});
 const response=await demote();assert.equal(response.status,200);assert.deepEqual(response.data.student.availableRoles,['student']);
 const after=users.get(studentId);assert.equal(after.organizerAccess,false);
 for(const key of ['role','password','program','yearLevel','section','academicHistory','faceDescriptor','faceEnrollmentVersion'])assert.deepEqual(after[key],before[key]);
 assert.equal(closedStations.length,1);assert.equal(closedStations[0].filter.openedBy,studentId);assert.ok(closedStations[0].update.$set.closedAt instanceof Date);
 assert.equal((await request('/organizer-desk',{auth:switched.data.token})).status,401);
 assert.equal((await request('/student-ledger',{auth:token(studentId,'student')})).status,200);
 assert.equal((await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}})).status,403);
 await promote();assert.equal((await request('/organizer-desk',{auth:switched.data.token})).status,401);
 const fresh=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}});assert.equal((await request('/organizer-desk',{auth:fresh.data.token})).status,200);
});
test('demotion is admin-only and rejects invalid or non-promoted accounts',async()=>{
 assert.equal((await demote()).status,409);assert.equal((await demote('bad')).status,400);assert.equal((await demote('999999999999999999999999')).status,404);assert.equal((await demote(adminId)).status,400);
 await promote();assert.equal((await demote(studentId,token(studentId,'student'))).status,403);
 const switched=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}});assert.equal((await demote(studentId,switched.data.token)).status,403);
 assert.equal((await demote()).status,200);assert.equal((await demote()).status,409);
});
test('notification failure cannot restore removed organizer access',async()=>{await promote();failNotification=true;const response=await demote();assert.equal(response.status,200);assert.equal(users.get(studentId).organizerAccess,false);assert.match(response.data.notificationWarning,/notification/);});
test('admin can correct academic details on ordinary and promoted students without changing history',async()=>{
 for(const promoted of [false,true]){
 if(promoted)await promote();const before={...users.get(studentId)};
 const response=await request(`/admin/users/${studentId}`,{method:'PATCH',auth:token(adminId,'admin'),body:{program:'bscs',yearLevel:2,section:'c'}});
 assert.equal(response.status,200);assert.equal(response.data.program,'BSCS');assert.equal(response.data.yearLevel,2);assert.equal(response.data.section,'C');assert.equal(response.data.password,undefined);assert.equal(response.data.faceDescriptor,undefined);
 for(const key of ['role','organizerAccess','faceEnrollmentVersion','academicHistory'])assert.deepEqual(users.get(studentId)[key],before[key]);
 }
});
test('academic changes reject invalid values and non-admin access',async()=>{
 for(const body of [{yearLevel:1.5},{yearLevel:0},{yearLevel:5},{yearLevel:''},{yearLevel:true},{program:''},{program:'invalid'},{program:'IT'},{program:'BSIS'},{program:'OTHER'},{section:'D'},{section:''}]){
 const response=await request(`/admin/users/${studentId}`,{method:'PATCH',auth:token(adminId,'admin'),body});assert.equal(response.status,400,JSON.stringify(body));
 }
 const denied=await request(`/admin/users/${studentId}`,{method:'PATCH',auth:token(studentId,'student'),body:{yearLevel:4}});assert.equal(denied.status,403);assert.equal(users.get(studentId).yearLevel,3);
});

const adjustBalance=(hours,expectedTotal=20,auth=token(adminId,'admin'),id=studentId)=>request(`/admin/users/${id}/community-service`,{method:'PATCH',auth,body:{hours,expectedTotal}});
function seedAttendance(){attendanceRecords=[8,8,4,0].map((hours,index)=>({_id:`record-${index}`,student:studentId,event:`event-${index}`,attendedAt:index,status:hours===8?'absent':hours===4?'late':'present',communityServiceHours:hours,communityServiceLog:hours?[{action:'penalty',hours}]:[],save:async function(){return this;}}));}
test('overall reductions span events oldest first while preserving attendance and penalty history',async()=>{
 seedAttendance();const response=await adjustBalance(6);assert.equal(response.status,200);assert.equal(response.data.totalHours,6);assert.deepEqual(attendanceRecords.map(record=>record.communityServiceHours),[0,2,4,0]);assert.deepEqual(attendanceRecords.map(record=>record.status),['absent','absent','late','present']);
 assert.deepEqual(attendanceRecords.slice(0,3).map(record=>record.communityServiceLog[0].hours),[8,8,4]);assert.equal(attendanceRecords[0].communityServiceLog[1].action,'removed');assert.match(attendanceRecords[0].communityServiceLog[1].note,/Overall balance/);
 assert.equal((await adjustBalance(0,6)).status,200);assert.equal(attendanceRecords.reduce((sum,record)=>sum+record.communityServiceHours,0),0);assert.equal(attendanceRecords.length,4);
});
test('overall increase is logged and total remains consistent across the existing ledger',async()=>{seedAttendance();const response=await adjustBalance(24);assert.equal(response.status,200);assert.equal(attendanceRecords.reduce((sum,record)=>sum+record.communityServiceHours,0),24);assert.equal(attendanceRecords[2].communityServiceLog[1].hours,4);});
test('overall adjustment preserves a legacy penalty even when its original log is missing',async()=>{seedAttendance();attendanceRecords[0].communityServiceLog=[];await adjustBalance(0);assert.equal(attendanceRecords[0].communityServiceLog[0].hours,8);assert.equal(attendanceRecords[0].communityServiceLog[1].action,'removed');});
test('stale totals and invalid totals do not change the balance',async()=>{
 seedAttendance();assert.equal((await adjustBalance(0,19)).status,409);
 for(const hours of [-1,'',null,true,'invalid'])assert.equal((await adjustBalance(hours)).status,400);
 assert.deepEqual(attendanceRecords.map(record=>record.communityServiceHours),[8,8,4,0]);
});
test('only admins can adjust overall student balances and no attendance is fabricated',async()=>{
 seedAttendance();assert.equal((await adjustBalance(0,20,token(studentId,'student'))).status,403);assert.equal((await adjustBalance(0,20,token(adminId,'admin'),adminId)).status,400);
 attendanceRecords=[];assert.equal((await adjustBalance(8,0)).status,400);assert.equal(attendanceRecords.length,0);assert.equal((await adjustBalance(0,0)).status,200);
});
test('notification errors do not report a successful balance update as failed',async()=>{seedAttendance();failNotification=true;const response=await adjustBalance(4);assert.equal(response.status,200);assert.match(response.data.notificationWarning,/notification/);assert.equal(attendanceRecords.reduce((sum,record)=>sum+record.communityServiceHours,0),4);});

test('promoted students see the same personal academic standing and face appeals in organizer portal',async()=>{
 await promote();const original=token(studentId,'student');const switched=await request('/auth/switch-role',{method:'POST',auth:original,body:{role:'organizer'}});
 const studentProfile=await request('/student/academic-status',{auth:original});const organizerProfile=await request('/student/academic-status',{auth:switched.data.token});assert.equal(studentProfile.status,200);assert.equal(organizerProfile.status,200);assert.deepEqual(organizerProfile.data.student,studentProfile.data.student);assert.equal(organizerProfile.data.student.yearLevel,3);assert.equal(organizerProfile.data.student.program,'BSIT');
 for(const auth of [original,switched.data.token]){const appeals=await request('/student/security/face-appeals',{auth});assert.equal(appeals.status,200);assert.equal(appeals.data[0].student,studentId);}
 const face=await request('/account/face',{method:'POST',auth:switched.data.token,body:{consent:true}});assert.equal(face.status,400);assert.equal(face.data.error,'No face photo uploaded');assert.equal(users.get(studentId).role,'student');
 assert.equal((await request('/student/community-service',{auth:switched.data.token})).status,403);
});
test('legacy organizers and admins do not gain student profile access',async()=>{
 users.get(otherId).role='organizer';
 for(const auth of [token(otherId,'organizer'),token(adminId,'admin')]){
 assert.equal((await request('/student/academic-status',{auth})).status,403);assert.equal((await request('/student/security/face-appeals',{auth})).status,403);assert.equal((await request('/account/face',{method:'POST',auth,body:{consent:true}})).status,403);
 }
});
test('shared organizer profile endpoints cannot select another student account',async()=>{
 await promote();const switched=await request('/auth/switch-role',{method:'POST',auth:token(studentId,'student'),body:{role:'organizer'}});
 const response=await request(`/student/security/face-appeals?studentId=${otherId}`,{auth:switched.data.token});assert.equal(response.status,200);assert.equal(response.data[0].student,studentId);
});
