const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const owner = '111111111111111111111111', admin = '222222222222222222222222', other = '333333333333333333333333';
const events = [owner, admin, other].map((organizer,i) => ({_id:String(i+4).repeat(24),organizer,title:'Event '+i}));
const stored = events.map((event,i)=>({_id:'station'+i,event:event._id,closedAt:null,expiresAt:new Date(Date.now()+3600000),createdAt:new Date(),stationLabel:'Entrance',matchCount:i}));
stored.push({...stored[0],_id:'closed',closedAt:new Date()}, {...stored[0],_id:'expired',expiresAt:new Date(0)});
const users = {find:()=>({distinct:async()=>[admin]}),findById:id=>({select:()=>({lean:async()=>({role:id===admin?'admin':'organizer'})})})};
const eventModel = {findById:async id=>events.find(e=>e._id===id),find:filter=>({select:()=>({lean:async()=>events.filter(e=>!filter.organizer || filter.organizer.$in.includes(e.organizer))})})};
const sessions = {find:filter=>({sort:()=>({lean:async()=>stored.filter(s=>filter.event.$in.includes(s.event)&&s.closedAt===null&&s.expiresAt>filter.expiresAt.$gt)})})};
Module._load=function(request,parent,...rest){const mocks={'../models/User':users,'../models/Event':eventModel,'../models/CheckInSession':sessions,'../middleware/authMiddleware':{protect:(req,res,next)=>next()},'../services/faceIdentify':{},'../services/attendanceMarking':{recordAttendance:async()=>{}}};return mocks[request]||originalLoad.call(this,request,parent,...rest)};
const router=require('../routes/checkinRoutes');Module._load=originalLoad;
const handler=router.stack.find(layer=>layer.route?.path==='/sessions'&&layer.route.methods.get).route.stack.at(-1).handle;
async function get(role,query={}){const result={status:200};await handler({user:{_id:owner,role},query},{status(code){result.status=code;return this},json(body){result.body=body;return this}});return result;}
test('overview includes owned and admin-created event stations with titles, excludes unrelated, closed and expired stations',async()=>{const r=await get('organizer');assert.equal(r.status,200);assert.deepEqual(r.body.map(s=>s.eventTitle),['Event 0','Event 1']);assert.deepEqual(r.body.map(s=>s.id),['station0','station1']);});
test('students cannot list stations across events',async()=>{assert.equal((await get('student')).status,403)});
test('single-event listing keeps ownership restrictions and validation',async()=>{assert.equal((await get('organizer',{eventId:events[2]._id})).status,403);assert.equal((await get('organizer',{eventId:'bad'})).status,400);assert.deepEqual((await get('organizer',{eventId:events[0]._id})).body.map(s=>s.id),['station0']);});
test('admins can monitor all event stations',async()=>{assert.equal((await get('admin')).body.length,3)});
