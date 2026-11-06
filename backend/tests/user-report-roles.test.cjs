const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let users, failRead, selectedFields;
const userModel = {
  find() {
    const query = {
      select(fields) { selectedFields=fields;return this; }, sort() { return this; },
      lean() { return this; },
      then(resolve,reject) {
        if (failRead) return Promise.reject(new Error('Unavailable')).then(resolve,reject);
        const rows=users.map(user=>Object.fromEntries(Object.entries(user).filter(([field])=>field==='_id'||selectedFields.split(' ').includes(field))));
        return Promise.resolve(rows).then(resolve,reject);
      },
    };return query;
  },
  aggregate() { assert.fail('User counts must come from the ledger snapshot, not a separate query'); },
};
const original=Module._load;
Module._load=function(name,parent,...rest){return name==='../models/User'?userModel:original.call(this,name,parent,...rest);};
const router=require('../routes/reportRoutes');Module._load=original;
beforeEach(()=>{
 failRead=false;selectedFields='';
 users=[{_id:'admin',name:'Admin',email:'admin@test.edu',role:'admin',organizerAccess:true},
 {_id:'student',name:'Student',email:'student@test.edu',role:'student',organizerAccess:false},
 {_id:'promoted',name:'Promoted',email:'promoted@test.edu',role:'student',organizerAccess:true,password:'private',faceDescriptor:[0.2]},
 {_id:'legacy',name:'Legacy',email:'legacy@test.edu',role:'organizer'},
 {_id:'demoted',name:'Demoted',email:'demoted@test.edu',role:'student',organizerAccess:false}];
});
async function report(path='/users'){
 const result={status:200};
 const res={status(value){result.status=value;return this;},json(value){result.body=value;return this;},setHeader(){},send(value){result.csv=value;return this;}};
 const route=router.stack.find(layer=>layer.route?.path===path&&layer.route.methods.get).route;
 await route.stack.at(-1).handle({},res);return result;
}
test('promoted students and legacy organizers count only under organizers',async()=>{
 const {body}=await report();assert.deepEqual(body.stats,{total:5,student:2,organizer:2,admin:1});
 assert.equal(body.stats.total,body.stats.student+body.stats.organizer+body.stats.admin);
 const promoted=body.users.find(user=>user._id==='promoted');assert.equal(promoted.role,'student');assert.equal(promoted.organizerAccess,true);
 assert.equal('password' in promoted,false);assert.equal('faceDescriptor' in promoted,false);
});
test('demotion moves an account back to Students without changing total accounts',async()=>{
 users[2].organizerAccess=false;const {body}=await report();assert.deepEqual(body.stats,{total:5,student:3,organizer:1,admin:1});
});
test('promotion moves a student into Event Organizers and leaves the identity intact',async()=>{
 users[1].organizerAccess=true;const {body}=await report();assert.deepEqual(body.stats,{total:5,student:1,organizer:3,admin:1});assert.equal(users[1].role,'student');
});
test('empty reports have zero counts in every category',async()=>{users=[];assert.deepEqual((await report()).body.stats,{total:0,student:0,organizer:0,admin:0});});
test('CSV roles retain organizer access and reflect demotion',async()=>{
 let result=await report('/users/export');assert.match(result.csv,/"Promoted","promoted@test.edu","Student\/Organizer"/);
 users[2].organizerAccess=false;result=await report('/users/export');assert.match(result.csv,/"Promoted","promoted@test.edu","student"/);assert.doesNotMatch(result.csv,/Student\/Organizer/);
});
test('database failure is reported rather than showing a misleading zero',async()=>{failRead=true;assert.equal((await report()).status,500);});
