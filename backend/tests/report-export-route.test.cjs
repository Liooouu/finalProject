const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let seenMatch, seenPeriod, studentReads=0;
const studentId='111111111111111111111111',eventId='222222222222222222222222',sessionId='333333333333333333333333';
const records=Array.from({length:215},(_,i)=>({_id:String(i),student:{_id:studentId,name:'Student',email:'s@school.edu',program:'BSIT',yearLevel:1,section:'A'},event:{_id:eventId,title:`Event ${i}`,date:'2026-11-09'},status:'absent',method:'auto',communityServiceHours:8}));
const query = value => ({populate(){return this;},select(){return this;},lean:async()=>value});
const original=Module._load;
Module._load=function(name,parent,...rest){
 const mocks={
  '../models/Attendance':{find(filter){seenMatch=filter;return query(records);}},
  '../models/User':{distinct:async()=>{studentReads++;return [studentId];}},
  '../models/Event':{findById:()=>query({title:'Selected event'})},
  '../models/ManualAttendanceRequest':{find:()=>query([])},
  '../services/academicPeriods':{attendanceFilter:async q=>{seenPeriod=q;return q.semester?{semester:q.semester}:{};}},
 };
 return Object.hasOwn(mocks,name)?mocks[name]:original.call(this,name,parent,...rest);
};
const router=require('../routes/reportRoutes');Module._load=original;
async function exportReport(query={}){
 const result={status:200,headers:{}};const res={status(n){result.status=n;return this;},json(body){result.body=body;},setHeader(k,v){result.headers[k]=v;},send(data){result.data=data;}};
 await router.stack.find(l=>l.route?.path==='/attendance/export').route.stack.at(-1).handle({query},res);return result;
}
test('all events export includes all 215 records regardless of current report page and ignores directory placeholders',async()=>{
 const result=await exportReport({page:2,limit:5});assert.equal(result.status,200);
 assert.equal(result.data.split('\r\n').length,216);assert.doesNotMatch(result.data,/No attendance|Marked At/);
 assert.equal(studentReads,0);assert.deepEqual(seenMatch,{});
});
test('export shares student, demographic, event, session, date, term and completion filters with the report',async()=>{
 const q={studentId,program:'BSIT',yearLevel:'1',section:'A',eventId,sessionId,completionStatus:'completed',academicYearStart:'2026',semester:'first',startDate:'2026-11-09',endDate:'2026-11-10'};
 const result=await exportReport(q);assert.equal(result.status,200);
 assert.equal(String(seenMatch.student),studentId);assert.equal(String(seenMatch.event),eventId);assert.equal(String(seenMatch.session),sessionId);
 assert.equal(seenMatch.completionStatus,'completed');assert.deepEqual(seenMatch.$and,[{semester:'first'}]);assert.equal(seenPeriod.academicYearStart,'2026');assert.ok(seenMatch.attendedAt.$gte);assert.ok(seenMatch.attendedAt.$lte);assert.equal(studentReads,1);
});
test('invalid export format is rejected instead of silently sending a CSV',async()=>{assert.equal((await exportReport({format:'pdf'})).status,400);});
