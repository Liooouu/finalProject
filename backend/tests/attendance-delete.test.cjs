const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');const original=Module._load;
let pending,deleted,archived,archiveFails;
const record={_id:'111111111111111111111111',event:'222222222222222222222222',student:'333333333333333333333333',updatedAt:new Date()};
const protect=()=>{},authorize=(...roles)=>{assert.deepEqual(roles,['admin']);return ()=>{};};
Module._load=function(name,parent,...args){const mocks={
 '../models/Attendance':{findById:()=>({lean:async()=>record}),deleteOne:async()=>{deleted++;return {deletedCount:1};}},
 '../models/DeletedAttendance':{updateOne:async()=>{if(archiveFails)throw Error('storage unavailable');archived++;}},
 '../models/ManualAttendanceRequest':{exists:async()=>pending},
 '../middleware/authMiddleware':{protect,authorize},
};return mocks[name]||original.call(this,name,parent,...args);};
const router=require('../routes/reportRoutes');
beforeEach(()=>{pending=false;deleted=0;archived=0;archiveFails=false;});
async function run(id=record._id){const result={status:200};const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};await router.stack.find(l=>l.route?.methods.delete).route.stack[0].handle({params:{id},user:{_id:record.student}},res);return result;}
test('deletion archives before removing the active record',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(archived,1);assert.equal(deleted,1);});
test('pending manual review blocks deletion',async()=>{pending=true;assert.equal((await run()).status,409);assert.equal(deleted,0);assert.equal(archived,0);});
test('invalid ids are rejected',async()=>{assert.equal((await run('bad')).status,400);assert.equal(deleted,0);});
test('archive failure preserves attendance',async()=>{archiveFails=true;assert.equal((await run()).status,500);assert.equal(deleted,0);});
test.after(()=>{Module._load=original;});
