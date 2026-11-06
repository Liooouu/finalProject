import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordsForAcademicPeriod,eventTerm,applyEventField} from '../src/utils/academicPeriods.js';
test('period filtering follows assignments rather than calendar dates',()=>{
 const records=[{date:'2030-01-01',academicYearStart:2026,semester:'first'},{date:'2026-01-01',academicYearStart:2026,semester:'second'},{date:'2026-10-01'}];
 assert.deepEqual(recordsForAcademicPeriod(records,{startYear:2026},'first'),[records[0]]);
 assert.deepEqual(recordsForAcademicPeriod(records,{unassigned:true}),[records[2]]);
 assert.equal(recordsForAcademicPeriod(records,null).length,3);
});
test('live event assignment wins over snapshots; deleted events use snapshots',()=>{
 assert.equal(eventTerm({event:{academicYearStart:null,semester:null},academicYearStart:2026,semester:'first'}),null);
 assert.deepEqual(eventTerm({event:null,academicYearStart:2026,semester:'second'}),{startYear:2026,semester:'second'});
});
test('one term selector updates both fields and preserves other form values',()=>{
 const current={title:'Event',location:'Hall'};
 assert.deepEqual(applyEventField(current,{name:'academicTerm',value:'2027:second'}),{...current,academicYearStart:2027,semester:'second'});
 assert.deepEqual(applyEventField(current,{name:'academicTerm',value:''}),{...current,academicYearStart:null,semester:null});
});
