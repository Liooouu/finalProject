import { rebaseEventAttendanceDates, syncAttendanceDeadlines } from "./attendanceSessions";
export function eventTerm(record) {
  const event=record?.event && typeof record.event==="object"?record.event:record;
  const startYear=event?.academicYearStart;
  const semester=event?.semester;
  return Number.isInteger(startYear)&&["first","second"].includes(semester)?{startYear,semester}:null;
}
export function academicTermLabel(record) {
  const term=eventTerm(record);
  return term?`${term.startYear}–${term.startYear+1} · ${term.semester==="first"?"1st":"2nd"} Semester`:"Unassigned academic term";
}
export const recordsForAcademicPeriod=(records,period,semester="all")=>{
  if(!period)return records;
  return records.filter(record=>{
    const term=eventTerm(record);
    if(period.unassigned)return !term;
    return !!term&&term.startYear===period.startYear&&(semester==="all"||term.semester===semester);
  });
};

export function applyEventField(previous,{name,value}) {
  if(name!=="academicTerm") {
    let next={...previous,[name]:value};
    if (["date","endDate"].includes(name)) next = rebaseEventAttendanceDates(previous,next);
    return ["date", "time", "attendanceSessions"].includes(name) ? syncAttendanceDeadlines(next) : next;
  }
  const [year,semester]=value.split(":");
  return {...previous,academicYearStart:year?Number(year):null,semester:semester||null};
}
