import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordPortalVisit,portalBackTarget} from '../src/utils/portalHistory.js';
const store=()=>{const data=new Map();return{get length(){return data.size;},key:n=>[...data.keys()][n],getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const user={id:'student-one',role:'student'},loc=(pathname,key)=>({pathname,key,search:'',hash:''});
test('dashboard never exposes an app Back route to auth or the public landing',()=>{
 const storage=store(),home=loc('/student/dashboard','home');recordPortalVisit(storage,home,user,1);
 assert.equal(portalBackTarget(storage,home,user,1).disabled,true);
});
test('Back follows a verified same-portal history entry',()=>{
 const storage=store(),home=loc('/student/dashboard','home'),events=loc('/student/dashboard/events','events'),profile=loc('/student/dashboard/profile','profile');
 recordPortalVisit(storage,home,user,1);recordPortalVisit(storage,events,user,2);recordPortalVisit(storage,profile,user,3);
 assert.equal(portalBackTarget(storage,profile,user,3).delta,-1);
 recordPortalVisit(storage,events,user,2,'POP');assert.equal(portalBackTarget(storage,events,user,2).delta,-1);
});
test('direct links, another account, another portal and unavailable storage use safe fallbacks',()=>{
 const storage=store(),events=loc('/student/dashboard/events','events');recordPortalVisit(storage,loc('/student/dashboard/profile','old'),user,0);recordPortalVisit(storage,events,user,1);
 assert.equal(portalBackTarget(storage,events,{...user,id:'other'},1).path,'/student/dashboard');
 assert.equal(portalBackTarget(storage,events,user,99,'/auth').path,'/student/dashboard');
 assert.equal(portalBackTarget(storage,events,user,99,'/admin/dashboard').path,'/student/dashboard');
 assert.equal(portalBackTarget({getItem:()=>{throw Error('blocked');}},events,user,1).path,'/student/dashboard');
});
test('public navigation and replacements invalidate stale history entries',()=>{
 const storage=store(),events=loc('/student/dashboard/events','events');recordPortalVisit(storage,loc('/student/dashboard/profile','old'),user,0);recordPortalVisit(storage,events,user,1);
 recordPortalVisit(storage,loc('/auth','auth'),user,2);recordPortalVisit(storage,events,user,3);
 assert.equal(portalBackTarget(storage,events,user,3).path,'/student/dashboard');
 recordPortalVisit(storage,loc('/student/dashboard','replacement'),user,3,'REPLACE');
 assert.equal(portalBackTarget(storage,events,user,3).path,'/student/dashboard');
});
