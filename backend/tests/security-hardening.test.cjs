const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module'),express=require('express');
const {activeStudentFilter,isActiveStudent}=require('../services/studentEligibility');
const {setBrowserCookie,browserMatches}=require('../services/stationBrowser');
const {loginThrottle}=require('../middleware/loginThrottle');
test('graduate and unverified students are excluded while legacy active accounts continue',()=>{
 assert.equal(isActiveStudent({role:'student'}),true);assert.equal(isActiveStudent({role:'student',enrollmentStatus:'graduated'}),false);
 assert.equal(isActiveStudent({role:'student',emailVerified:false}),false);assert.equal(isActiveStudent({role:'admin'}),false);
 assert.deepEqual(activeStudentFilter(),{role:'student',enrollmentStatus:{$ne:'graduated'},emailVerified:{$ne:false}});
});
test('station requires an HttpOnly browser cookie: copied URLs and altered cookies cannot scan',()=>{
 let cookie;const tokenHash='a'.repeat(64),expires=new Date(Date.now()+60000);
 const hash=setBrowserCookie({cookie(name,value,options){cookie={name,value,options};}},tokenHash,expires);
 assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.sameSite,'strict');assert.equal(cookie.options.path,'/api/checkin');
 const session={tokenHash,browserSecretHash:hash};
 assert.equal(browserMatches({headers:{cookie:`other=1; ${cookie.name}=${cookie.value}`}},session),true);
 for(const req of [{},{headers:{}},{headers:{cookie:`${cookie.name}=wrong`}}])assert.equal(browserMatches(req,session),false);
 assert.equal(browserMatches({headers:{cookie:`${cookie.name}=${cookie.value}`}},{tokenHash}),false);
});
test('repeated password guesses are limited per account and a successful login clears the counter',()=>{
 const req={ip:'qa-ip',body:{email:'rate-test@example.test'}},result={};let next=0;
 const res={set(){return this;},status(code){result.status=code;return this;},json(value){result.body=value;return this;}};
 for(let i=0;i<10;i++)loginThrottle(req,res,()=>next++);
 loginThrottle(req,res,()=>next++);assert.equal(next,10);assert.equal(result.status,429);
 req.clearLoginAttempts();loginThrottle(req,res,()=>next++);assert.equal(next,11);
});

let server,base,reads,letter;
const original=Module._load;
Module._load=function(name,parent,...rest){
 if(parent?.filename.endsWith('fileRoutes.js')){
  if(name==='../middleware/authMiddleware')return{protect(req,res,next){if(!req.headers['x-qa-role'])return res.status(401).end();req.user={_id:req.headers['x-qa-id'],role:req.headers['x-qa-role']};next();}};
  if(name==='../models/Excuse')return{findOne:()=>({select:async()=>letter})};
  if(name==='../services/fileStore')return{sendFile:async(res,url,options)=>{reads++;res.set('Cache-Control',options.cacheControl).send('private evidence');}};
 }
 return original.call(this,name,parent,...rest);
};
const files=require('../routes/fileRoutes');Module._load=original;
before(async()=>{const app=express();app.use('/files',files);server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{reads=0;letter={student:'owner'};});
test('excuse attachments reject guests and unrelated students without exposing evidence',async()=>{
 assert.equal((await fetch(base+'/files/proof.pdf')).status,401);
 assert.equal((await fetch(base+'/files/proof.pdf',{headers:{'x-qa-role':'student','x-qa-id':'other'}})).status,404);assert.equal(reads,0);
});
test('attachment owners and authorized staff open files with private no-store caching',async()=>{
 for(const [role,id]of[['student','owner'],['organizer','staff'],['admin','admin']]){
  const response=await fetch(base+'/files/proof.pdf',{headers:{'x-qa-role':role,'x-qa-id':id}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(await response.text(),'private evidence');
 }
 assert.equal(reads,3);
});
test('unreferenced files and scriptable extensions cannot use attachment reader',async()=>{
 letter=null;assert.equal((await fetch(base+'/files/proof.pdf',{headers:{'x-qa-role':'admin'}})).status,404);
 assert.equal((await fetch(base+'/files/payload.html',{headers:{'x-qa-role':'admin'}})).status,404);assert.equal(reads,0);
});
