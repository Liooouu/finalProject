const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let stored, deleted, failDatabase, failCleanup, lastUpdate;
const users = {
  findByIdAndUpdate(id, update, options) {
    assert.equal(id, 'account-self');
    assert.equal(options.new, false);
    lastUpdate = update;
    const previous = stored ? { ...stored } : null;
    if (stored && !failDatabase) Object.assign(stored, update.$set);
    return { select: async fields => {
      if (failDatabase) throw new Error('Database unavailable');
      if (!previous) return null;
      const projected = { _id: previous._id };
      for (const field of fields.split(' ')) if (field in previous) projected[field] = previous[field];
      return projected;
    } };
  },
};
const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const mocks = {
    '../models/User': users,
    '../services/faceMatcher': {},
    '../services/faceIdentify': {},
    '../services/mailer': {},
    '../services/fileStore': { deleteByUrl: async url => { if (failCleanup) throw new Error('Storage unavailable'); deleted.push(url); } },
  };
  return mocks[request] || originalLoad.call(this, request, parent, ...rest);
};
const router = require('../routes/accountRoutes');
Module._load = originalLoad;
const route = router.stack.find(layer => layer.route?.path === '/picture' && layer.route.methods.delete).route;
beforeEach(() => {
  stored = { _id:'account-self', name:'Test User', role:'student', organizerAccess:false,
    profilePicture:'/uploads/avatar.jpg', facePhoto:'/uploads/face.jpg', faceEnrolledAt:'2026-11-01',
    faceConsentAt:'2026-11-01', faceDescriptor:[0.1,0.2], faceEnrollmentVersion:3,
    password:'private-hash', sessionVersion:7 };
  deleted=[]; failDatabase=false; failCleanup=false; lastUpdate=null;
});
async function remove(role='student', body={}) {
  const result={ status:200 };
  const res={ status(code){result.status=code;return this;}, json(value){result.body=value;return this;} };
  await route.stack.at(-1).handle({ user:{_id:'account-self',role},body },res);
  return result;
}
for (const role of ['student','organizer','admin']) test(`${role} removes only their own profile photo`,async()=>{
  stored.role=role; const result=await remove(role,{userId:'another-account'});
  assert.equal(result.status,200);assert.equal(stored.profilePicture,'');assert.equal(result.body.user.profilePicture,'');
  assert.deepEqual(lastUpdate,{$set:{profilePicture:''}});assert.deepEqual(deleted,['/uploads/avatar.jpg']);
  assert.equal(stored.facePhoto,'/uploads/face.jpg');assert.deepEqual(stored.faceDescriptor,[0.1,0.2]);
  assert.equal(stored.faceEnrollmentVersion,3);assert.equal(stored.sessionVersion,7);
  for(const field of ['password','faceDescriptor','sessionVersion'])assert.equal(field in result.body.user,false);
});
test('promoted student keeps both access roles and face enrollment',async()=>{
  stored.organizerAccess=true;const {body}=await remove('organizer');
  assert.equal(body.user.role,'organizer');assert.equal(body.user.accountRole,'student');
  assert.deepEqual(body.user.availableRoles,['student','organizer']);assert.ok(body.user.faceEnrolledAt);
});
test('repeat removal is harmless and does not delete other files',async()=>{
  await remove();await remove();assert.deepEqual(deleted,['/uploads/avatar.jpg']);
});
test('legacy avatar reference to the face file clears without deleting biometric storage',async()=>{
  stored.profilePicture=stored.facePhoto;await remove();assert.equal(stored.profilePicture,'');assert.deepEqual(deleted,[]);assert.equal(stored.facePhoto,'/uploads/face.jpg');
});
test('database failure keeps the photo and reports failure',async()=>{
  failDatabase=true;const result=await remove();assert.equal(result.status,500);assert.equal(stored.profilePicture,'/uploads/avatar.jpg');assert.deepEqual(deleted,[]);
});
test('missing account returns 404 without storage cleanup',async()=>{
  stored=null;assert.equal((await remove()).status,404);assert.deepEqual(deleted,[]);
});
test('storage cleanup failure does not restore the removed public profile reference',async()=>{
  failCleanup=true;assert.equal((await remove()).status,200);assert.equal(stored.profilePicture,'');
});
test('authentication runs before profile-photo removal',async()=>{
  let status;await route.stack[0].handle({headers:{}},{status(value){status=value;return this;},json(){}},()=>assert.fail('Unauthenticated deletion was allowed'));
  assert.equal(status,401);assert.equal(lastUpdate,null);
});
