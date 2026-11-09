const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let rows=[],reads=0,pendingRead;
const users={find:()=>{reads++;const snapshot=structuredClone(rows);return {select:()=>({lean:()=>pendingRead?pendingRead(snapshot):Promise.resolve(snapshot)})};}};
const original=Module._load;
Module._load=function(request,parent,...rest){if(request==='../models/User'&&parent.filename.endsWith('faceIdentify.js'))return users;return original.call(this,request,parent,...rest);};
const index=require('../services/faceIdentify');Module._load=original;
const vector=n=>Array(128).fill(n);
const student=(id,n,version=1)=>({_id:id,name:'QA Student',role:'student',faceDescriptor:vector(n),faceEnrollmentVersion:version,faceEnrolledAt:new Date(),faceConsentAt:new Date()});
beforeEach(()=>{index.clear();rows=[];reads=0;pendingRead=null;});

test('a miss refreshes an enrollment saved by another API process',async()=>{
 rows=[student('one',0)];await index.refresh();
 rows=[student('one',0.1,2)];
 const result=await index.identifyBatch([vector(0.1),vector(0.101)]);
 assert.equal(result.result,'match');assert.equal(result.student.id,'one');assert.equal(result.student.enrollmentVersion,2);assert.equal(reads,2);
});
test('repeated unknown probes share a bounded miss-refresh cooldown',async()=>{
 rows=[student('one',0)];await index.refresh();
 for(let n=0;n<4;n++)assert.equal((await index.identifyBatch([vector(0.2),vector(0.201)])).result,'unknown');
 assert.equal(reads,2);
});
test('a cached empty index discovers a new enrollment without waiting five minutes',async()=>{
 await index.refresh();rows=[student('one',0)];
 assert.equal((await index.identifyBatch([vector(0),vector(0.001)])).result,'match');
});
test('enrollment saved during an index read cannot be overwritten by its old snapshot',async()=>{
 rows=[student('one',0)];await index.refresh();let finish;
 pendingRead=snapshot=>new Promise(resolve=>{finish=()=>resolve(snapshot);});
 const loading=index.refresh();index.upsert(student('one',0.1,2));finish();await loading;
 assert.equal((await index.identify(vector(0.1))).student.enrollmentVersion,2);
});
test('reset during an index read cannot restore a removed reference',async()=>{
 rows=[student('one',0)];await index.refresh();let finish;
 pendingRead=snapshot=>new Promise(resolve=>{finish=()=>resolve(snapshot);});
 const loading=index.refresh();index.remove('one');finish();await loading;
 assert.equal(index.size(),0);
});
test('a refresh after a miss still refuses colliding enrollment references',async()=>{
 rows=[student('one',0)];await index.refresh();rows=[student('one',0.1,2),student('two',0.101)];
 assert.equal((await index.identifyBatch([vector(0.1),vector(0.101)])).result,'ambiguous');
});
