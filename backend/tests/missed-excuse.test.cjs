const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
const eventId='222222222222222222222222';
let absent,active,created,savedFiles;
class Excuse {constructor(values){Object.assign(this,values);}async save(){created=this;}static async findOne(){return active;}}
Module._load=function(request,parent,...rest){const mocks={
 '../models/Excuse':Excuse,'../models/Event':{findById:async()=>({_id:eventId,title:'Missed event',organizer:'organizer'})},
 '../models/Attendance':{findOne:async query=>{assert.equal(query.student,'self');assert.equal(query.status,'absent');return absent;}},
 '../models/User':{find:()=>({select:async()=>[]})},
 '../middleware/authMiddleware':{protect:(req,res,next)=>{req.user={_id:'self',name:'Test',role:req.headers['x-test-role']||'student'};next();}},
 '../services/fileStore':{saveBuffer:async(buffer,options)=>{savedFiles.push(options);return{url:`/uploads/test-${savedFiles.length}`};},deleteByUrls:async()=>{}},
};return mocks[request]||originalLoad.call(this,request,parent,...rest);};
const router=require('../routes/studentRoutes');Module._load=originalLoad;
const app=require('express')();app.use('/student',router);app.use((err,req,res,next)=>res.status(err.status||400).json({error:err.message}));
let server;const ready=new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});after(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{absent={status:'absent'};active=null;created=null;savedFiles=[];});
async function submit({files=[{name:'proof.pdf',type:'application/pdf',content:'%PDF-1.4'}],type='absence',text='A supported explanation',id=eventId,role='student'}={}){
 await ready;const data=new FormData();data.set('eventId',id);data.set('excuseText',text);data.set('type',type);
 for(const file of files)data.append('attachments',new Blob([file.content||'document'],{type:file.type}),file.name);
 const response=await fetch(`http://127.0.0.1:${server.address().port}/student/excuses`,{method:'POST',headers:{'x-test-role':role},body:data});return{status:response.status,body:await response.json()};
}
test('a missed-event excuse accepts a required PDF attachment',async()=>{assert.equal((await submit()).status,201);assert.equal(created.type,'absence');assert.equal(created.attachments.length,1);assert.equal(savedFiles[0].contentType,'application/pdf');});
test('requests without attachments are rejected without saving',async()=>{const result=await submit({files:[]});assert.equal(result.status,400);assert.match(result.body.error,/attachment/);assert.equal(created,null);});
test('advance requests cannot bypass the removed UI option',async()=>{assert.equal((await submit({type:'advance'})).status,400);assert.equal(created,null);});
test('a student needs an actual absence for the event',async()=>{absent=null;assert.equal((await submit()).status,400);assert.equal(created,null);});
test('blank explanations and invalid event IDs are rejected',async()=>{assert.equal((await submit({text:'   '})).status,400);assert.equal((await submit({id:'invalid'})).status,400);});
test('pending and approved requests cannot be duplicated',async()=>{for(const status of ['pending','approved']){active={status};assert.equal((await submit()).status,400);}assert.equal(created,null);});
test('DOC, DOCX and image attachments match the advertised file types',async()=>{const files=[{name:'proof.doc',type:'application/msword'},{name:'proof.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},{name:'proof.jpg',type:'image/jpeg'},{name:'proof.png',type:'image/png'}];assert.equal((await submit({files})).status,201);assert.equal(created.attachments.length,4);});
test('five attachments are allowed and six are rejected by upload middleware',async()=>{const files=Array.from({length:5},(_,i)=>({name:`proof${i}.pdf`,type:'application/pdf'}));assert.equal((await submit({files})).status,201);assert.equal((await submit({files:[...files,files[0]]})).status,400);});
test('oversized and unsupported files are rejected',async()=>{assert.equal((await submit({files:[{name:'large.pdf',type:'application/pdf',content:Buffer.alloc(5*1024*1024+1)}]})).status,400);assert.equal((await submit({files:[{name:'proof.html',type:'text/html'}]})).status,400);assert.equal(created,null);});
test('non-students cannot submit student excuse letters',async()=>{assert.equal((await submit({role:'organizer'})).status,403);assert.equal(created,null);});
