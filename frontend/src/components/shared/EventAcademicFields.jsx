import React, { useEffect } from "react";
import { useAcademicPeriods } from "../../utils/useAcademicPeriods";
import { academicTermLabel } from "../../utils/academicPeriods";
export default function EventAcademicFields({value,onChange,creating=false,readOnly=false,disabled=false}) {
  const {calendar,error,refresh}=useAcademicPeriods();
  useEffect(()=>{
    if(creating&&value.academicYearStart===undefined&&calendar?.configured){
      onChange({target:{name:"academicTerm",value:`${calendar.current.startYear}:${calendar.currentSemester.id}`}});
    }
  },[creating,value.academicYearStart,calendar,onChange]);
  if(readOnly)return <p className="text-sm text-on-dim">Academic term: {academicTermLabel(value)}<span className="block mt-1 text-xs text-on-muted">An administrator can correct this assignment.</span></p>;
  const selected=value.academicYearStart&&value.semester?`${value.academicYearStart}:${value.semester}`:"";
  return <div className="min-w-0">
    <label className="field-label" htmlFor={creating?"new-event-academic-term":"edit-event-academic-term"}>School year &amp; semester</label>
    <select id={creating?"new-event-academic-term":"edit-event-academic-term"} name="academicTerm" aria-label="Event school year and semester" className="field-select" required={creating} disabled={disabled} value={selected} onChange={onChange}>
      <option value="">{creating?"Choose an academic term":"Unassigned"}</option>
      {calendar?.years?.flatMap(year=>year.semesters.map(term=><option key={`${year.startYear}:${term.id}`} value={`${year.startYear}:${term.id}`}>{year.label} · {term.label}</option>))}
    </select>
    {error?<p role="alert" className="field-hint text-danger">School terms unavailable. <button type="button" className="underline" onClick={refresh}>Try again</button></p>:<p className="field-hint">{creating?(calendar?.configured?"Defaults to the current term. Choose another for a future event.":"Ask an administrator to add a school year and set the current term."):"Changing the assignment updates record grouping without changing attendance or service hours."}</p>}
  </div>;
}
