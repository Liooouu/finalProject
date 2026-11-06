import React, { useState } from "react";
import api from "../../api/axios";
import { useAcademicPeriods } from "../../utils/useAcademicPeriods";
import { Button, Card } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function AcademicPeriodsSettings() {
  const {calendar,error,refresh}=useAcademicPeriods();
  const [newYear,setNewYear]=useState(""),[year,setYear]=useState(""),[draftSemester,setSemester]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failure,setFailure]=useState(""),[confirm,setConfirm]=useState(false);
  const selectedYear=year || String(calendar?.current?.startYear || calendar?.years?.[0]?.startYear || "");
  const semester=draftSemester || calendar?.currentSemester?.id || "first";
  const add=async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setFailure("");setMessage("");
    try{await api.post("/academic-periods/years",{startYear:Number(newYear)});setYear(newYear);setNewYear("");await refresh();setMessage("School year added. Choose its semester when you are ready to make it current.");}
    catch(e){setFailure(e.response?.data?.message||"Could not add the school year.");}finally{setBusy(false);}
  };
  const activate=async()=>{
    if(busy)return;setBusy(true);setFailure("");setMessage("");
    try{await api.put("/academic-periods/current",{startYear:Number(selectedYear),semester,version:calendar.version});await refresh();setConfirm(false);setMessage("Current term updated. Existing event assignments and student records were kept.");}
    catch(e){setFailure(e.response?.data?.message||"Could not set the current term.");setConfirm(false);await refresh();}finally{setBusy(false);}
  };
  return <div className="space-y-4">
    <Card><p className="text-xs text-on-muted">Current academic term</p><h2 className="mt-2 text-xl font-semibold text-on">{calendar?.configured?`${calendar.current.label} · ${calendar.currentSemester.label}`:"No current term set"}</h2><p className="mt-2 text-sm text-on-dim">Set this manually when the department changes semesters. Official start dates are not required.</p></Card>
    {error&&<div role="alert" className="alert alert-danger">School terms unavailable.<Button variant="secondary" size="sm" onClick={refresh}>Try again</Button></div>}
    {failure&&<p role="alert" className="alert alert-danger">{failure}</p>}
    {message&&<p role="status" className="alert alert-ok">{message}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card as="form" onSubmit={add}><h3 className="text-base font-semibold text-on">Add school year</h3><label className="field-label mt-4" htmlFor="school-year-start">Starting year</label><input id="school-year-start" type="number" min="2026" max="2100" step="1" required className="field" placeholder="e.g. 2026" value={newYear} onChange={e=>setNewYear(e.target.value)} disabled={busy}/><p className="mt-2 text-xs text-on-muted">{newYear?`School year ${newYear}–${Number(newYear)+1}`:"For example, 2026 creates S.Y. 2026–2027."} Adding a year does not activate it.</p><Button className="mt-4" type="submit" disabled={busy||!calendar}>Add school year</Button></Card>
      <Card as="form" onSubmit={e=>{e.preventDefault();setFailure("");setConfirm(true);}}><h3 className="text-base font-semibold text-on">Set current term</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-on-muted">School year<select aria-label="Current school year" className="field-select mt-1" required value={selectedYear} disabled={busy} onChange={e=>setYear(e.target.value)}><option value="">Choose a school year</option>{calendar?.years?.map(item=><option key={item.startYear} value={item.startYear}>{item.label}</option>)}</select></label><label className="text-xs text-on-muted">Semester<select aria-label="Current semester" className="field-select mt-1" value={semester} disabled={busy} onChange={e=>setSemester(e.target.value)}><option value="first">1st Semester</option><option value="second">2nd Semester</option></select></label></div><p className="mt-3 text-xs text-on-muted">New events default to this term. Student year levels, existing events, attendance, and service balances stay unchanged.</p><Button className="mt-4" type="submit" disabled={busy||!selectedYear||!calendar}>Set current term</Button></Card>
    </div>
    <p className="text-xs text-on-muted">Assign older events from Manage Events → Edit event. School-year advancement remains a separate reviewed action under Year levels.</p>
    <ConfirmDialog open={confirm} title="Set the current academic term?" message={`Use S.Y. ${selectedYear}–${Number(selectedYear)+1}, ${semester==="first"?"1st":"2nd"} Semester for new events? Existing records will not be reassigned.`} confirmLabel="Set current term" variant="primary" busy={busy} onCancel={()=>setConfirm(false)} onConfirm={activate}/>
  </div>;
}
