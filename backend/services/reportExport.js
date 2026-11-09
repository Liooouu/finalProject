// Report-only projections: never write back to attendance, student or ledger data.
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const compare = (a, b) => collator.compare(String(a || ''), String(b || ''));
const dateTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
const instant = value => value && Number.isFinite(+new Date(value)) ? new Date(value) : null;
const stamp = value => instant(value) ? dateTime.format(instant(value)) : 'Not recorded';
const year = u => u.enrollmentStatus === 'graduated' ? 5 : [1, 2, 3, 4].includes(Number(u.yearLevel)) ? Number(u.yearLevel) : 6;
const surname = u => u.lastName?.trim() || (u.name?.includes(',') ? u.name.split(',')[0].trim() : u.name || '');
function compareStudents(a = {}, b = {}) {
  const programs = ['BSIT', 'BSCS', 'BSEMC'];
  const rank = p => programs.includes(p) ? programs.indexOf(p) : 3;
  return year(a) - year(b) || rank(a.program) - rank(b.program) || compare(a.program, b.program)
    || compare(a.section, b.section) || compare(surname(a), surname(b)) || compare(a.name, b.name)
    || compare(a.email, b.email) || compare(a._id, b._id);
}
const label = value => ({ present: 'Present', on_time: 'On time', late: 'Late', absent: 'Absent', excused: 'Excused', completed: 'Completed', incomplete: 'Incomplete' }[value] || value || 'Not recorded');
const ATTENDANCE_HEADERS = ['Year Level', 'Program', 'Section', 'Student Name', 'Student Email', 'Event', 'Day / Session', 'Status', 'Time In (PHT)', 'Time Out (PHT)', 'Completion', 'Penalty Hours', 'Remaining Service Hours'];
function attendanceRows(records) {
  const session = r => r.event?.attendanceSessions?.find(s => String(s._id) === String(r.session));
  const eventDate = r => +(instant(r.event?.date || r.eventDate) || 0);
  const sessionDate = r => +(instant(session(r)?.timeInOpen || r.timeInAt) || 0);
  const sorted = [...records].sort((a, b) => compareStudents(a.student || {}, b.student || {})
    || eventDate(a) - eventDate(b) || compare(a.event?.title || a.eventTitle, b.event?.title || b.eventTitle)
    || compare(a.event?._id, b.event?._id) || sessionDate(a) - sessionDate(b)
    || compare(a.sessionName, b.sessionName) || compare(a._id, b._id));
  return [ATTENDANCE_HEADERS, ...sorted.map(r => {
    const u = r.student || {}, s = session(r);
    const date = instant(s?.timeInOpen || r.event?.date || r.eventDate);
    const legacy = !r.session;
    const entry = r.timeInAt || (legacy && ['present', 'late'].includes(r.status) && r.method !== 'auto' ? r.attendedAt : null);
    const completion = r.manualReviewPending ? 'Pending review' : legacy ? 'Time In only'
      : r.completionStatus === 'pending' ? (entry ? 'Awaiting Time Out' : 'Awaiting Time In') : label(r.completionStatus);
    return [year(u) === 5 ? 'Graduated' : year(u) === 6 ? 'Unassigned' : year(u), u.program || 'Unassigned', u.section || 'Unassigned',
      u.name || 'Unavailable student', u.email || '', r.event?.title || r.eventTitle || 'Unavailable event',
      `${date ? day.format(date) + ' · ' : ''}${r.sessionName || s?.name || (legacy ? 'Time In only' : 'Event attendance')}`,
      r.status === 'pending' ? 'Pending' : label(r.status), stamp(entry), legacy ? 'Not applicable' : stamp(r.timeOutAt), completion,
      r.manualReviewProvisional ? 0 : Number.isFinite(r.sessionPenaltyHours) ? r.sessionPenaltyHours : r.status === 'absent' ? 8 : r.status === 'late' ? 4 : 0,
      Number.isFinite(r.communityServiceHours) ? r.communityServiceHours : 0];
  })];
}
function exportFormat(query = {}) {
  const value = query.format || 'csv';
  if (!['csv', 'xlsx'].includes(value)) throw Object.assign(new Error('Choose Excel or CSV export.'), { status: 400 });
  return value;
}
function csvCell(value) {
  let text = value == null ? '' : String(value);
  text = text.replace(/[\r\n]+/g, ' ').trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
async function sendReport(res, filename, rows, format = 'csv') {
  const base = filename.replace(/\.(csv|xlsx)$/i, '');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.${format}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
  }
  // Lazy server-side loading keeps Excel code out of portal page bundles.
  const ExcelJS = require('exceljs');
  const book = new ExcelJS.Workbook(); book.creator = 'TrackED';
  const sheet = book.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.addRows(rows);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length), column: rows[0].length } };
  sheet.pageSetup.printTitlesRow = '1:1';
  sheet.columns.forEach((column, i) => {
    const header = String(rows[0][i]);
    column.width = /Email/.test(header) ? 38 : /Time In|Time Out/.test(header) ? 27
      : /Event|Title|Name|Session/.test(header) ? 34 : /Hours|Completion|Status/.test(header) ? 23 : 17;
  });
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'middle', wrapText: true };
    row.font = { name: 'Calibri', size: 11, color: { argb: 'FF253042' } };
    let lines = 1;
    row.eachCell((cell, i) => {
      // Literal strings are never interpreted as formulas, hyperlinks or image references.
      if (typeof cell.value === 'string') lines = Math.max(lines, Math.ceil(cell.value.length / Math.max(10, sheet.getColumn(i).width - 3)));
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 1 ? 'FF403278' : index % 2 ? 'FFF2F0F8' : 'FFFFFFFF' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDAD6E5' } } };
      if (typeof cell.value === 'number') cell.numFmt = /Hours/.test(String(rows[0][i - 1])) ? '0.##' : '0';
    });
    row.height = index === 1 ? 34 : Math.max(28, lines * 16 + 10);
    if (index === 1) row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(Buffer.from(await book.xlsx.writeBuffer()));
}
module.exports = { compareStudents, attendanceRows, exportFormat, sendReport, csvCell };
