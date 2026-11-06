import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Button, Card } from "../ui";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { formatDateTime } from "../../utils/helpers";
import { FaUndo } from "react-icons/fa";

const labels = { advanced: "Advanced", retained: "Kept year", unchanged: "Unchanged", graduated: "Graduated", skipped: "Not updated", failed: "Failed", pending: "Pending" };
const statuses = { completed: "Academic update completed", partial: "Some records need another attempt", running: "Update in progress", undone: "Update undone", reverting: "Undo in progress", undo_partial: "Undo needs attention" };

export default function AcademicUpdateResults({ batchId, revision, fallback, disabled, onUndo, containerRef }) {
  const [data,setData]=useState(null),[page,setPage]=useState(1),[search,setSearch]=useState("");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");
      try {
        const response=await api.get(`/admin/academic-advancement/${batchId}/results`,{params:{page,search},signal:controller.signal});
        if(active){setData(response.data);if(response.data.page!==page)setPage(response.data.page);}
      }catch(err){if(active)setError(err.response?.data?.message||"Could not load saved results. Please try again.");}
      finally{if(active)setLoading(false);}
    },search?200:0);
    return()=>{active=false;controller.abort();clearTimeout(timer);};
  },[batchId,page,search,revision,attempt]);
  const batch=data?.batch||(fallback?.batchId===batchId?fallback:null);
  const scope=batch?.classScope;
  const canUndo=batch&&["completed","partial","reverting","undo_partial"].includes(batch.status);
  const undoAttempt=batch&&["undone","undo_partial","reverting"].includes(batch.status);
  return <Card as="section" id="academic-saved-results" ref={containerRef} tabIndex={-1} aria-label="Saved academic update results" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {batch&&<><p className="mt-1 text-sm font-medium text-on">{scope?`${scope.program} · Year ${scope.yearLevel} · Section ${scope.section}`:"All classes (earlier update)"}</p>
          <p className="mt-1 text-xs text-on-dim">S.Y. {batch.sourceYear}–{batch.sourceYear+1} → {batch.targetYear}–{batch.targetYear+1}{batch.createdAt&&` · ${formatDateTime(batch.createdAt)}`}</p></>}
      </div>
      {canUndo&&<Button size="sm" variant="secondary" disabled={disabled||loading} onClick={()=>onUndo(batch)}><FaUndo aria-hidden="true" />{["reverting","undo_partial"].includes(batch.status)?"Retry undo":"Undo this update"}</Button>}
    </div>
    {batch&&<><p role="status" className="text-sm font-medium text-on">{statuses[batch.status]||batch.status}</p>
      <p className="text-sm text-on-dim">{undoAttempt?`${batch.undo.counts.restored} restored · ${batch.undo.counts.skipped+batch.undo.counts.failed} need review`:<>{batch.counts.advanced} advanced · {batch.unchangedCount||batch.counts.retained} unchanged · {batch.counts.graduated} graduated{batch.counts.skipped>0&&` · ${batch.counts.skipped} skipped`}{batch.counts.failed>0&&` · ${batch.counts.failed} failed`}</>}</p>
      <p className="text-xs text-on-muted">{undoAttempt?"Restored rows show the year returned by Undo. Rows needing review have not been restored by this action.":"Previous and updated year levels are shown for this batch."}</p></>}
    {data?.batchSize>5&&<div><label htmlFor="academic-results-search" className="field-label">Search saved results</label><input id="academic-results-search" type="search" className="field" value={search} placeholder="Student name or email" onChange={event=>{setSearch(event.target.value);setPage(1);}} /></div>}
    {error&&<div role="alert" className="text-sm text-danger">{error}<Button size="sm" variant="ghost" onClick={()=>setAttempt(value=>value+1)}>Retry results</Button></div>}
    {loading&&<p role="status" className="text-xs text-on-muted">Loading saved results...</p>}
    <StablePage pageKey={`${batchId}:${search}`} loading={loading} footer={data&&<Pagination page={data.page} pageSize={5} total={data.total} onChange={setPage} disabled={loading} label="Saved result pages" />}>
      {!!data?.students.length&&<ul aria-label="Students in saved update" aria-busy={loading}>
        {data.students.map(student=><li key={student.studentId} className="academic-result-row">
          <div className="academic-result-student"><p className="font-medium text-on">{student.name}</p><p className="mt-1 text-xs text-on-muted">{student.email}</p></div>
          <div><span className="academic-result-caption">{student.undoOutcome==="restored"?"Before undo":"Previous year"}</span><p>{student.undoOutcome==="restored"?(student.outcome==="graduated"?"Graduated":`Year ${student.updatedYearLevel}`):`Year ${student.previousYearLevel}`}</p></div>
          <div><span className="academic-result-caption">{student.undoOutcome==="restored"?"Restored year":"Year after update"}</span><p>{student.undoOutcome==="restored"?`Year ${student.previousYearLevel}`:student.outcome==="graduated"?"Graduated":student.updatedYearLevel?`Year ${student.updatedYearLevel}`:student.outcome==="pending"?"Pending":"Not applied"}</p></div>
          <div><span className="academic-result-caption">Result</span><p className={["skipped","failed"].includes(student.undoOutcome)?"text-danger":["advanced","graduated"].includes(student.outcome)||student.undoOutcome==="restored"?"text-ok":"text-on-dim"}>{student.undoOutcome==="restored"?"Restored":["skipped","failed"].includes(student.undoOutcome)?"Undo needs review":labels[student.outcome]||student.outcome}</p>
            {student.message&&<p className="mt-1 text-xs text-on-muted">{student.message}</p>}
            {student.undoMessage&&<p className="mt-1 text-xs text-on-muted">{student.undoMessage}</p>}
          </div>
        </li>)}
      </ul>}
      {!loading&&data&&!data.students.length&&<p className="py-4 text-sm text-on-muted">No students match your search.</p>}
    </StablePage>
  </Card>;
}
