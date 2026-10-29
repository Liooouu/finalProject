const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');const express=require('express');
const id='333333333333333333333333',eventId='222222222222222222222222';
let letter,event,attendance,uploaded,deleted,race,notifyFail;
const copy=value=>value==null?null:structuredClone(value);
function query(value){return {populate(){return this;},select(){return this;},sort(){return this;},then(ok,bad){let result=copy(value);if(result&&!Array.isArray(result))Object.defineProperty(result,'toObject',{value(){return {...this};}});if(Array.isArray(result))result=result.map(item=>({...item,toObject(){return {...item};}}));return Promise.resolve(result).then(ok,bad);}};}
const originalLoad=Module._load;
Module._load=function(name,parent,...rest){const mocks={
 '../models/Excuse':{
 find:()=>query([{...letter,event}]),
 findOne:filter=>{if(typeof filter._id==='object')return query(null);return query(filter._id===id&&filter.student===letter.student?{...letter,event}:null);},
 findOneAndUpdate:(filter,update)=>{if(race){letter.status='approved';return query(null);}const version=filter.submissionVersion||filter.$or?.[0].submissionVersion;if(letter.status!==filter.status||(letter.submissionVersion||1)!==version)return query(null);Object.assign(letter,update.$set);letter.submissionHistory.push(update.$push.submissionHistory);return query({...letter,event});},
 },
 '../models/Event':{},'../models/Attendance':{find:()=>query(attendance?[{event:eventId}]:[]),findOne:async()=>attendance},
 '../models/User':{find:()=>query([{_id:'reviewer'}])},'../models/FaceAppeal':{},
 '../middleware/authMiddleware':{protect:(req,res,next)=>{req.user={_id:req.headers['x-student']||'self',name:'Student',role:req.headers['x-role']||'student'};next();}},
 '../services/fileStore':{saveBuffer:async()=>{const url='/uploads/new-'+(uploaded.length+1)+'.pdf';uploaded.push(url);return {url};},deleteByUrls:async urls=>deleted.push(...urls)},
 '../services/notify':{notifyUsers:async()=>{if(notifyFail)throw Error('offline');}},
 };return mocks[name]||originalLoad.call(this,name,parent,...rest);};
const router=require('../routes/studentRoutes');Module._load=originalLoad;
const app=express();app.use('/student',router);app.use((error,req,res,next)=>res.status(400).json({error:error.message}));
let server;const ready=new Promise(resolve=>server=app.listen(0,'127.0.0.1',resolve));after(()=>new Promise(resolve=>server.close(resolve)));
// Two days ago guarantees the event ended before the original submission,
// including morning test runs in Manila when a UTC date can still be yesterday.
beforeEach(()=>{const first=new Date(Date.now()-12*3600000);event={_id:eventId,title:'Test event',organizer:'owner',date:new Date(Date.now()-2*86400000).toISOString().slice(0,10),endTime:'23:59'};letter={_id:id,student:'self',event:eventId,type:'absence',status:'pending',excuseText:'Original explanation',attachments:['/uploads/original.pdf'],attachmentUrl:'/uploads/original.pdf',createdAt:first,lastSubmittedAt:first,submissionVersion:1,submissionHistory:[],responseNote:''};attendance={status:'absent'};uploaded=[];deleted=[];race=false;notifyFail=false;});
async function revise({text='Updated explanation',version=1,retained=['/uploads/original.pdf'],files=[],student='self',role='student'}={}){
 await ready;const body=new FormData();body.set('excuseText',text);body.set('expectedVersion',String(version));body.set('retainedAttachments',JSON.stringify(retained));for(const file of files)body.append('attachments',new Blob(['%PDF-1.4'],{type:'application/pdf'}),file);
 const response=await fetch(`http://127.0.0.1:${server.address().port}/student/excuses/${id}`,{method:'PATCH',headers:{'x-student':student,'x-role':role},body});return{status:response.status,body:await response.json()};
}
test('pending letter resubmits in place, keeps first timestamp and advances latest/version',async()=>{const first=letter.createdAt.toISOString();const result=await revise();assert.equal(result.status,200);assert.equal(result.body._id,id);assert.equal(letter.createdAt.toISOString(),first);assert.equal(letter.submissionVersion,2);assert.ok(letter.lastSubmittedAt>letter.createdAt);assert.equal(letter.submissionHistory[0].excuseText,'Original explanation');assert.equal(letter.excuseText,'Updated explanation');assert.deepEqual(letter.attachments,['/uploads/original.pdf']);assert.equal(letter.status,'pending');});
test('rejected letter returns to pending and retains the previous review in history',async()=>{letter.status='rejected';letter.responseNote='Please attach clearer evidence';letter.reviewedBy='reviewer';assert.equal((await revise()).status,200);assert.equal(letter.status,'pending');assert.equal(letter.responseNote,'');assert.equal(letter.reviewedBy,null);assert.equal(letter.submissionHistory[0].responseNote,'Please attach clearer evidence');});
test('an on-time existing letter may be revised after seven days',async()=>{event.date=new Date(Date.now()-10*86400000).toISOString().slice(0,10);letter.createdAt=new Date(Date.now()-9*86400000);assert.equal((await revise()).status,200);});
test('late original submissions cannot gain eligibility by resubmission',async()=>{event.date=new Date(Date.now()-10*86400000).toISOString().slice(0,10);letter.createdAt=new Date();assert.equal((await revise()).status,400);assert.equal(letter.submissionVersion,1);});
test('approved letters and other students letters cannot be changed',async()=>{letter.status='approved';assert.equal((await revise()).status,400);letter.status='pending';assert.equal((await revise({student:'other'})).status,404);assert.equal((await revise({role:'organizer'})).status,403);assert.equal(letter.submissionVersion,1);});
test('resubmission requires actual absence and missed-event type',async()=>{attendance=null;assert.equal((await revise()).status,400);attendance={status:'absent'};letter.type='advance';assert.equal((await revise()).status,400);});
test('new evidence can replace retained attachments without deleting revision history files',async()=>{assert.equal((await revise({retained:[],files:['replacement.pdf']})).status,200);assert.deepEqual(letter.attachments,['/uploads/new-1.pdf']);assert.deepEqual(letter.submissionHistory[0].attachments,['/uploads/original.pdf']);assert.deepEqual(deleted,[]);});
test('attachments cannot be empty, forged or exceed five',async()=>{assert.equal((await revise({retained:[]})).status,400);assert.equal((await revise({retained:['/uploads/someone-else.pdf']})).status,400);assert.equal((await revise({files:['1.pdf','2.pdf','3.pdf','4.pdf','5.pdf']})).status,400);assert.equal(uploaded.length,0);});
test('stale edits and concurrent approvals cannot overwrite a final letter',async()=>{assert.equal((await revise({version:2})).status,409);race=true;assert.equal((await revise({files:['new.pdf']})).status,409);assert.equal(letter.status,'approved');assert.equal(letter.excuseText,'Original explanation');assert.deepEqual(deleted,['/uploads/new-1.pdf']);});
test('notification failures retain the resubmitted letter and its uploaded evidence',async()=>{notifyFail=true;const result=await revise({files:['new.pdf']});assert.equal(result.status,200);assert.match(result.body.notificationWarning,/saved/);assert.equal(letter.submissionVersion,2);assert.deepEqual(deleted,[]);});
test('student history exposes first/latest timestamps and final approval lock',async()=>{await ready;for(const status of ['pending','approved']){letter.status=status;const response=await fetch(`http://127.0.0.1:${server.address().port}/student/excuses`);const body=await response.json();assert.equal(response.status,200);assert.equal(body[0].createdAt,letter.createdAt.toISOString());assert.equal(body[0].lastSubmittedAt,letter.lastSubmittedAt.toISOString());assert.equal(body[0].canResubmit,status==='pending');}});

test("legacy letters without a revision field can be resubmitted safely",async()=>{delete letter.submissionVersion;assert.equal((await revise()).status,200);assert.equal(letter.submissionVersion,2);});
