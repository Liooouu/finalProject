const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const UserModel = require('../models/User');
let currentUser, mailEnabled, saved;
class User {
  constructor(values) { Object.assign(this, values); this._id='111111111111111111111111'; }
  async save() { saved++; currentUser=this; }
  async comparePassword(password) { return password === 'ValidPass123!'; }
  async compareEmailCode(code) { return code === '123456'; }
  async comparePasswordCode(code) { return code === '123456'; }
  async setEmailCode() { this.emailVerificationCodeHash='email-hash'; }
  async setPasswordCode() { this.passwordResetCodeHash='reset-hash'; }
  static normalizeEmail(value) { return String(value).trim().toLowerCase(); }
  static generateCode() { return '123456'; }
  static async findOne() { return currentUser; }
  static async findByIdAndUpdate(id, update) { if(update.$inc) for(const [key,value] of Object.entries(update.$inc)) currentUser[key]=(currentUser[key]||0)+value; else Object.assign(currentUser,update); return currentUser; }
}
Module._load = function(request, parent, ...rest) {
  const mocks={ '../models/User':User, '../services/mailer':{isMailEnabled:async()=>mailEnabled,sendMail:async()=>true}, '../services/emailTemplate':{renderVerificationEmail:async()=>({}),renderPasswordResetEmail:async()=>({})} };
  return mocks[request] || originalLoad.call(this,request,parent,...rest);
};
const router=require('../routes/authRoutes');
Module._load=originalLoad;
process.env.JWT_SECRET='local-test-only-secret';
beforeEach(()=>{currentUser=new User({role:'student',email:'test@example.test',name:'Test',emailVerified:true,faceDescriptor:Array(128).fill(0),faceConsentAt:new Date(),faceEnrolledAt:new Date()});mailEnabled=true;saved=0;});
async function request(path,body) { const route=router.stack.find(l=>l.route?.path===path && l.route.methods.post)?.route; assert.ok(route,`missing ${path}`); const result={status:200};const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};await route.stack.at(-1).handle({body,headers:{}},res);return result; }
test('user schema has no security PIN or trusted-device fields and generates email codes',()=>{for(const field of ['pinHash','pinPlain','pinAttempts','pinLockUntil','trustedDevices']) assert.equal(UserModel.schema.path(field),undefined);assert.match(UserModel.generateCode(),/^\d{6}$/);assert.equal(UserModel.prototype.setPin,undefined);});
test('enrolled students sign in with password alone on an unknown device',async()=>{currentUser.pinLockUntil=new Date(Date.now()+3600000);const r=await request('/login',{email:'test@example.test',password:'ValidPass123!'});assert.equal(r.status,200);assert.ok(r.body.token);assert.equal(r.body.requiresFaceEnrollment,false);assert.equal(r.body.pin,undefined);assert.equal(r.body.requiresPin,undefined);assert.equal(saved,0);});
test('unenrolled students are directed to face enrollment',async()=>{currentUser.faceEnrolledAt=null;const r=await request('/login',{email:'test@example.test',password:'ValidPass123!'});assert.equal(r.body.requiresFaceEnrollment,true);});

test('graduated students can sign in for historical records without being forced to enroll a face',async()=>{currentUser.enrollmentStatus='graduated';currentUser.faceEnrolledAt=null;const r=await request('/login',{email:currentUser.email,password:'ValidPass123!'});assert.equal(r.status,200);assert.equal(r.body.requiresFaceEnrollment,false);assert.ok(r.body.token);});
test('legacy photos can continue to self-service attendance enrollment',async()=>{currentUser.facePhoto='/old-photo';currentUser.faceConsentAt=null;const r=await request('/login',{email:'test@example.test',password:'ValidPass123!'});assert.equal(r.body.requiresFaceEnrollment,true);assert.equal(r.body.enrollmentNeedsReset,undefined);});
test('organizers and admins do not enter student enrollment',async()=>{for(const role of ['organizer','admin']){currentUser.role=role;currentUser.faceEnrolledAt=null;const r=await request('/login',{email:'test@example.test',password:'ValidPass123!'});assert.ok(r.body.token);assert.equal(r.body.requiresFaceEnrollment,false);}});
test('wrong passwords remain rejected',async()=>{assert.equal((await request('/login',{email:'test@example.test',password:'wrong'})).status,400);});
test('unverified email still blocks login when mail is enabled',async()=>{currentUser.emailVerified=false;const r=await request('/login',{email:'test@example.test',password:'ValidPass123!'});assert.equal(r.status,403);assert.equal(r.body.requiresEmailVerification,true);assert.equal(r.body.token,undefined);});
test('registration has no PIN assignment and starts enrollment when email is disabled',async()=>{currentUser=null;mailEnabled=false;const r=await request('/register',{name:'Test Student',email:'test@example.test',password:'ValidPass123!',program:'BSIT',yearLevel:3,section:'A',role:'admin'});assert.equal(r.status,201);assert.equal(r.body.role,'student');assert.equal(r.body.requiresFaceEnrollment,true);assert.equal(r.body.pin,undefined);assert.ok(r.body.token);});
test('registration with mail enabled retains email verification',async()=>{currentUser=null;const r=await request('/register',{name:'Test Student',email:'test@example.test',password:'ValidPass123!',program:'BSIT',yearLevel:3,section:'A'});assert.equal(r.body.requiresEmailVerification,true);assert.equal(r.body.token,undefined);});
test('email verification goes directly to face enrollment without a PIN',async()=>{Object.assign(currentUser,{emailVerified:false,faceEnrolledAt:null,faceConsentAt:null,emailVerificationCodeHash:'hash',emailVerificationExpires:new Date(Date.now()+60000)});const r=await request('/verify-email',{email:currentUser.email,code:'123456'});assert.ok(r.body.token);assert.equal(r.body.requiresFaceEnrollment,true);assert.equal(r.body.pin,undefined);});
test('forgot password keeps responses generic for unknown and known accounts',async()=>{const known=await request('/forgot-password',{email:currentUser.email});currentUser=null;const unknown=await request('/forgot-password',{email:'unknown@example.test'});assert.deepEqual(known,unknown);});
test('password reset accepts a valid email code and clears it without signing in',async()=>{Object.assign(currentUser,{passwordResetCodeHash:'hash',passwordResetExpires:new Date(Date.now()+60000)});const r=await request('/forgot-password/verify',{email:currentUser.email,code:'123456',password:'NewValidPass123!'});assert.equal(r.status,200);assert.equal(currentUser.password,'NewValidPass123!');assert.equal(currentUser.passwordResetCodeHash,'');assert.equal(r.body.token,undefined);});

test('signup validates academic details and requires email verification',async()=>{
 currentUser=null;
 const r=await request('/register',{firstName:'Test',lastName:'Student',email:'new@example.test',password:'ValidPass123!',program:'BSCS',yearLevel:2,section:'B'});
 assert.equal(r.status,201);assert.equal(r.body.requiresEmailVerification,true);assert.equal(r.body.token,undefined);
 assert.equal(currentUser.emailVerified,false);assert.equal(currentUser.name,'Test Student');assert.equal(currentUser.program,'BSCS');assert.equal(currentUser.yearLevel,2);assert.equal(currentUser.section,'B');
});

test('signup rejects missing or invalid academic details',async()=>{
 currentUser=null;
 const data={name:'Test Student',email:'new@example.test',password:'ValidPass123!',program:'BSIT',yearLevel:1,section:'A'};
 for(const invalid of [{program:undefined},{program:'IT'},{yearLevel:1.5},{yearLevel:5},{section:'D'}]) {
  assert.equal((await request('/register',{...data,...invalid})).status,400);assert.equal(saved,0);
 }
});

test('unverified accounts remain blocked when email delivery is disabled',async()=>{
 currentUser.emailVerified=false;mailEnabled=false;const r=await request('/login',{email:currentUser.email,password:'ValidPass123!'});assert.equal(r.status,403);assert.equal(currentUser.emailVerified,false);assert.equal(r.body.token,undefined);
});
test('production signup fails closed when mail is disabled and password resets revoke old session versions',async()=>{
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';currentUser=null;mailEnabled=false;const result=await request('/register',{name:'Student',email:'official@example.test',password:'ValidPass123!'});assert.equal(result.status,503);assert.equal(saved,0);}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
 currentUser=new User({role:'student',email:'reset@example.test',emailVerified:true,passwordResetCodeHash:'hash',passwordResetExpires:new Date(Date.now()+60000),sessionVersion:4});
 await request('/forgot-password/verify',{email:currentUser.email,code:'123456',password:'NewValidPass123!'});assert.equal(currentUser.sessionVersion,5);
});
test('password reset rejects expired and incorrect codes',async()=>{Object.assign(currentUser,{passwordResetCodeHash:'hash',passwordResetExpires:new Date(0)});assert.equal((await request('/forgot-password/verify',{email:currentUser.email,code:'123456',password:'NewValidPass123!'})).status,400);currentUser.passwordResetExpires=new Date(Date.now()+60000);assert.equal((await request('/forgot-password/verify',{email:currentUser.email,code:'654321',password:'NewValidPass123!'})).status,400);assert.equal(currentUser.passwordResetAttempts,1);});
test('retired PIN, device and face-recovery authentication endpoints are absent',()=>{for(const path of ['/verify-device','/rotate-pin','/devices','/forgot-pin','/forgot-pin/verify','/forgot-pin/appeal','/forgot-pin/reset-request']) assert.equal(router.stack.some(l=>l.route?.path===path),false);});

test('staff PIN reset endpoints are absent while face reset remains available', () => {
  const adminRouter = require('../routes/adminRoutes');
  const paths = adminRouter.stack.filter(l => l.route).map(l => l.route.path);
  assert.ok(paths.includes('/users/:id/face'));
  assert.equal(paths.some(p => /pin-reset|reset-security/.test(p)), false);
});


test('structured signup stores name parts and a compatible display name',async()=>{
 currentUser=null; mailEnabled=false;
 const r=await request('/register',{firstName:' Ana ',middleName:'Maria',lastName:'De la Cruz',email:'ana@example.test',password:'ValidPass123!',program:'BSIT',yearLevel:2,section:'A'});
 assert.equal(r.status,201); assert.equal(currentUser.name,'Ana Maria De la Cruz'); assert.equal(currentUser.lastName,'De la Cruz');
});
test('structured signup requires first and last name without saving',async()=>{
 currentUser=null; const r=await request('/register',{firstName:'Ana',lastName:'',email:'ana@example.test',password:'ValidPass123!'});
 assert.equal(r.status,400); assert.equal(saved,0);
});
