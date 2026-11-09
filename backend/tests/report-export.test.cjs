const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { attendanceRows, sendReport, exportFormat } = require('../services/reportExport');
const s = (id, yearLevel, lastName, program = 'BSIT', extra = {}) => ({ _id:id, yearLevel, lastName, name:`First ${lastName}`, email:`${id}@school.edu`, program, section:'A', ...extra });
const r = (student, extra = {}) => ({ _id:student._id, student, event:{_id:'e',title:'Department event',date:'2026-11-09T00:00:00+08:00'}, status:'absent',method:'auto',communityServiceHours:8,attendedAt:'2026-11-09T18:00:00+08:00',...extra });
const response = () => ({ headers:{},setHeader(k,v){this.headers[k]=v;},send(data){this.data=data;} });
test('all attendance is ordered Year 1–4, program, section and saved surname; graduated/unassigned last', () => {
 const records=[r(s('four',4,'Zulu')),r(s('two',2,'Zulu')),r(s('oneZ',1,'Zulu')),r(s('oneA',1,'Álvarez')),r(s('three',3,'A')),r(s('grad',4,'A','BSIT',{enrollmentStatus:'graduated'})),r(s('missing',null,'A')),r(s('cs',1,'A','BSCS'))];
 const before=structuredClone(records),rows=attendanceRows(records);
 assert.deepEqual(rows.slice(1).map(row=>row[4]),['oneA','oneZ','cs','two','three','four','grad','missing'].map(id=>`${id}@school.edu`));
 assert.deepEqual(records,before);assert.equal(rows[7][0],'Graduated');assert.equal(rows[8][0],'Unassigned');
});
test('sessions remain separate and show their own day, with actual scans rather than automatic absence time',()=>{
 const user=s('x',1,'Student'),first={_id:'s1',name:'Day 1',timeInOpen:'2026-11-09T07:00:00+08:00'},second={_id:'s2',name:'Day 2',timeInOpen:'2026-11-10T07:00:00+08:00'};
 const e={_id:'e',title:'Department event',date:'2026-11-09',attendanceSessions:[first,second]};
 const rows=attendanceRows([r(user,{event:e,session:'s2',sessionName:'Day 2',completionStatus:'absent'}),r(user,{event:e,session:'s1',sessionName:'Day 1',timeInAt:'2026-11-09T08:00:00+08:00',timeOutAt:'2026-11-09T17:30:00+08:00',status:'present',completionStatus:'completed',sessionPenaltyHours:0,communityServiceHours:0})]);
 assert.equal(rows.length,3);assert.match(rows[1][6],/Nov 9, 2026.*Day 1/);assert.match(rows[2][6],/Nov 10, 2026.*Day 2/);
 assert.match(rows[1][8],/8:00 AM/);assert.equal(rows[2][8],'Not recorded');assert.equal(rows[2][9],'Not recorded');
});
test('legacy scans, pending reviews and adjusted balances retain distinct meanings',()=>{
 const user=s('x',1,'Student');
 const rows=attendanceRows([r(user,{status:'late',method:'face',communityServiceHours:2}),r(user,{_id:'pending',session:'s',manualReviewPending:true,manualReviewProvisional:true,status:'pending',communityServiceHours:0,sessionPenaltyHours:8})]);
 const legacy=rows.find(row=>row[10]==='Time In only'),pending=rows.find(row=>row[10]==='Pending review');
 assert.match(legacy[8],/6:00 PM/);assert.equal(legacy[11],4);assert.equal(legacy[12],2);
 assert.equal(pending[8],'Not recorded');assert.equal(pending[11],0);
});
test('empty export contains headers only, never an invented no-attendance student row',()=>assert.equal(attendanceRows([]).length,1));
test('CSV is UTF-8 with escaped text and neutralized formulas; formats are validated',async()=>{
 const res=response();await sendReport(res,'attendance.csv',[['Name','Hours'],['=HYPERLINK("bad")',0],['José, "Jr"',4]],'csv');
 assert.ok(res.data.startsWith('\uFEFF'));assert.match(res.data,/'=HYPERLINK/);assert.match(res.data,/José, ""Jr""/);assert.equal(res.headers['Cache-Control'],'no-store');
 assert.equal(exportFormat({}), 'csv');assert.throws(()=>exportFormat({format:'pdf'}),{status:400});
});
test('Excel opens with text-safe cells, numeric hours, widths, filters, frozen header and banded rows',async()=>{
 const res=response();await sendReport(res,'attendance.csv',[['Student Name','Penalty Hours'],['=not a formula',4],['José Student',0]],'xlsx');
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(res.data);const sheet=wb.worksheets[0];
 assert.equal(sheet.getCell('A2').value,'=not a formula');assert.equal(sheet.getCell('B2').value,4);assert.equal(sheet.views[0].ySplit,1);
 assert.ok(sheet.autoFilter);assert.ok(sheet.getColumn(1).width>=30);assert.equal(sheet.getRow(1).font.bold,true);assert.notDeepEqual(sheet.getCell('A2').fill,sheet.getCell('A3').fill);
 assert.equal(sheet.pageSetup.orientation,'landscape');assert.match(res.headers['Content-Disposition'],/attendance.xlsx/);
});
