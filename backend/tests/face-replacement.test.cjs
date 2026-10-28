const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let user, detectedError, storageError, saveError, cacheUser, persisted, deleted, calls, uploaded;
const descriptor=Array(128).fill(0.2);
const users={ findById:async id=>{assert.equal(id,'student-self');return user;} };
const store={saveBuffer:async(buffer,options)=>{calls.push('store');assert.equal(options.private,true);if(storageError)throw new Error('storage unavailable');return{url:'/uploads/new-face'};},deleteByUrl:async url=>{calls.push('delete');deleted.push(url);} };
const identify={upsert:u=>{calls.push('cache');cacheUser={...u};}};
Module._load=function(request,parent,...rest){
 const mocks={ '../models/User':users,'../services/faceMatcher':{detectFaceDescriptorFromBuffer:async()=>{if(detectedError)throw detectedError;return{descriptor};}},'../services/fileStore':store,'../services/faceIdentify':identify,'../services/mailer':{isMailEnabled:async()=>false} };
 return mocks[request]||originalLoad.call(this,request,parent,...rest);
};
const router=require('../routes/accountRoutes');Module._load=originalLoad;
const route=router.stack.find(l=>l.route?.path==='/face' && l.route.methods.post).route;
beforeEach(()=>{detectedError=null;storageError=false;saveError=false;cacheUser=null;persisted=null;deleted=[];calls=[];uploaded=true;user={_id:'student-self',role:'student',name:'Test Student',facePhoto:'/uploads/old-face',faceDescriptor:Array(128).fill(0.1),faceEnrollmentVersion:1,save:async function(){calls.push('save');if(saveError)throw new Error('DB unavailable');persisted={...this};}};});
async function upload(body={consent:'true'}){const result={status:200};const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};await route.stack.at(-1).handle({user:{_id:'student-self'},body,file:uploaded?{buffer:Buffer.from('test-photo'),originalname:'face.jpg',mimetype:'image/jpeg'}:null},res);return result;}
test('students replace their enrolled face without password or administrator approval',async()=>{const result=await upload();assert.equal(result.status,200);assert.equal(persisted.facePhoto,'/uploads/new-face');assert.deepEqual(persisted.faceDescriptor,descriptor);assert.equal(persisted.faceEnrollmentVersion,2);assert.ok(persisted.faceConsentAt);assert.equal(cacheUser.facePhoto,'/uploads/new-face');assert.deepEqual(deleted,['/uploads/old-face']);assert.deepEqual(calls,['store','save','cache','delete']);});
test('first enrollment remains supported',async()=>{user.facePhoto='';user.faceEnrollmentVersion=0;assert.equal((await upload()).status,200);assert.equal(persisted.faceEnrollmentVersion,1);assert.deepEqual(deleted,[]);});
test('legacy recovery photo can be replaced without a reset',async()=>{user.faceEnrolledAt=null;user.faceConsentAt=null;assert.equal((await upload()).status,200);assert.ok(persisted.faceEnrolledAt);});
test('consent is still required and old enrollment remains unchanged',async()=>{assert.equal((await upload({})).status,400);assert.equal(persisted,null);assert.equal(user.facePhoto,'/uploads/old-face');assert.deepEqual(deleted,[]);});
test('missing photo is rejected without changing enrollment',async()=>{uploaded=false;assert.equal((await upload()).status,400);assert.equal(persisted,null);});
test('no-face and multiple-face captures preserve the old enrollment',async()=>{for(const code of ['NO_FACE','MULTIPLE_FACES']){detectedError=Object.assign(new Error(code),{code});const result=await upload();assert.equal(result.status,400);if(code==='MULTIPLE_FACES')assert.match(result.body.error,/one face/);assert.equal(user.facePhoto,'/uploads/old-face');assert.equal(persisted,null);}assert.deepEqual(deleted,[]);});
test('failed file storage does not remove the current photo',async()=>{storageError=true;assert.equal((await upload()).status,500);assert.equal(persisted,null);assert.deepEqual(deleted,[]);});
test('failed database save removes only the unused new photo',async()=>{saveError=true;assert.equal((await upload()).status,500);assert.equal(persisted,null);assert.deepEqual(deleted,['/uploads/new-face']);assert.equal(cacheUser,null);});
test('face enrollment remains restricted to signed-in student accounts',()=>{const result={};const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};let allowed=false;route.stack[1].handle({user:{role:'organizer'}},res,()=>{allowed=true;});assert.equal(result.status,403);assert.equal(allowed,false);});

test('promoted student may manage their own face in organizer portal without switching stored identity',()=>{let allowed=false;const res={status(){throw new Error('Promoted student was denied');}};route.stack[1].handle({user:{role:'organizer',accountRole:'student'}},res,()=>{allowed=true;});assert.equal(allowed,true);});
