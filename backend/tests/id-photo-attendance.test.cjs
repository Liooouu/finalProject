const {test}=require('node:test');
const assert=require('node:assert/strict');
const jpeg=require('jpeg-js');
const {proposalFromTicket,safePhoto}=require('../services/idPhotoAttendance');
const base=Date.UTC(2026,10,6,0);
const data={kind:'capture',issuedMs:base+60000,schedule:{start:base,deadline:base+120000,cutoff:base+3600000}};
test('server capture fixes attendance time independently of upload time or claimed device time',()=>{
 const result=proposalFromTicket(data,{capturedAt:new Date(base+300000).toISOString()},new Date(base+86400000));
 assert.equal(+result.effectiveAt,data.issuedMs);assert.equal(result.proposedStatus,'present');assert.equal(result.proposedHours,0);assert.equal(result.captureBasis,'server');
});
test('offline device time remains a separate review basis and cannot escape signed event boundaries',()=>{
 const offline={...data,kind:'offline'};
 const result=proposalFromTicket(offline,{capturedAt:new Date(base+180000).toISOString()},new Date(base+86400000));
 assert.equal(result.captureBasis,'device');assert.equal(result.proposedStatus,'late');assert.equal(result.proposedHours,4);
 for(const time of [base,base+4000000,NaN])assert.throws(()=>proposalFromTicket(offline,{capturedAt:Number.isFinite(time)?new Date(time).toISOString():'bad'},new Date(base+86400000)),{status:400});
});
test('ID evidence must decode as JPEG within bounded dimensions',()=>{
 for(const file of [null,{mimetype:'image/jpeg',buffer:Buffer.from('fake image')},{mimetype:'text/html',buffer:Buffer.from('<html>')}])assert.throws(()=>safePhoto(file),{status:400});
 const buffer=jpeg.encode({width:320,height:200,data:Buffer.alloc(320*200*4,255)},85).data;
 assert.ok(safePhoto({buffer,mimetype:'image/jpeg'}).length>0);
});

const {preparationState}=require('../services/idPhotoAttendance');
const event={date:'2026-11-05',time:'08:00',endTime:'17:00',attendanceStartTime:'08:00',attendanceEndTime:'10:00',status:'live'};
test('closed or elapsed events produce a normal unavailable preparation state',()=>{
 const elapsed=preparationState(event,new Date('2026-11-06T01:00:00Z'));
 assert.equal(elapsed.available,false);assert.equal(elapsed.state,'closed');
 assert.equal(preparationState({...event,status:'finished'},new Date('2026-11-05T01:00:00Z')).available,false);
 assert.equal(preparationState({...event,status:'closed'},new Date('2026-11-05T01:00:00Z')).available,false);
});
test('invalid schedules are explained while open and future events can prepare',()=>{
 assert.equal(preparationState({...event,date:null},new Date('2026-11-05T01:00:00Z')).state,'invalid_schedule');
 assert.equal(preparationState(event,new Date('2026-11-05T00:30:00Z')).state,'open');
 assert.equal(preparationState(event,new Date('2026-11-04T23:00:00Z')).state,'before');
});
