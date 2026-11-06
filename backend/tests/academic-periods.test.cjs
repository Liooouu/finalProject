const {test}=require('node:test');
const assert=require('node:assert/strict');
const periods=require('../services/academicPeriods');
test('school year validation rejects partial, invalid and pre-system years',()=>{
 for(const value of [2025,2101,'2026abc',2026.5,null,''])assert.throws(()=>periods.yearNumber(value),{status:400});
 assert.equal(periods.yearNumber('2026'),2026);
});
test('filters use explicit metadata and preserve unassigned legacy records',()=>{
 assert.deepEqual(periods.eventFilter({}),{});
 assert.deepEqual(periods.eventFilter({academicYearStart:'2026',semester:'second'}),{academicYearStart:2026,semester:'second'});
 assert.deepEqual(periods.eventFilter({academicYearStart:'unassigned'}),{$or:[{academicYearStart:null},{semester:null}]});
 assert.throws(()=>periods.eventFilter({semester:'summer'}),{status:400});
});
test('organizer may edit ordinary event details but cannot change a saved term',async()=>{
 const existing={academicYearStart:2026,semester:'first'};
 assert.deepEqual(await periods.eventAssignment({title:'Edited'},{existing,role:'organizer'}),{});
 assert.deepEqual(await periods.eventAssignment({...existing},{existing,role:'organizer'}),{});
 await assert.rejects(periods.eventAssignment({academicYearStart:2026,semester:'second'},{existing,role:'organizer'}),{status:403});
 assert.deepEqual(await periods.eventAssignment({academicYearStart:null,semester:null},{existing,role:'admin'}),{academicYearStart:null,semester:null});
});
test('term view requires a configured year and semester and returns no guessed dates',()=>{
 assert.equal(periods.view({academicPeriods:{years:[2026],active:{startYear:2027,semester:'first'}}}).configured,false);
 const view=periods.view({academicPeriods:{years:[2026,2027,2026],active:{startYear:2026,semester:'second'},version:4}});
 assert.deepEqual(view.years.map(y=>y.startYear),[2027,2026]);assert.equal(view.currentSemester.id,'second');assert.equal(view.version,4);
 assert.ok(view.years.every(y=>y.semesters.every(s=>!('start' in s)&&!('end' in s))));
});
