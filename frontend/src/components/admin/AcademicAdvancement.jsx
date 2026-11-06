import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { Button, Card } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import PaginatedList from "../ui/PaginatedList";
import AcademicResultsDialog from "./AcademicResultsDialog";
import { FaEye, FaSearch, FaUndo, FaSyncAlt } from "react-icons/fa";
import { formatDateTime } from "../../utils/helpers";
import "../../styles/academic-advancement.css";

const emptyFilters=()=>({program:"",yearLevel:"",section:""});
const label=scope=>scope?`${scope.program} · Year ${scope.yearLevel} · Section ${scope.section}`:"All classes (earlier update)";
const schoolYear=year=>`S.Y. ${year}–${year+1}`;
const scopeOf=key=>{const [program,yearLevel,section]=key.split(":");return {program,yearLevel:Number(yearLevel),section};};
const countsText=item=>["undone","undo_partial","reverting"].includes(item.status)?`${item.undo.counts.restored} restored · ${item.undo.counts.skipped+item.undo.counts.failed} need review`:`${item.counts.advanced} advanced · ${item.unchangedCount??item.counts.retained} unchanged · ${item.counts.graduated} graduated`;

export default function AcademicAdvancement({onApplied}){
  const [params,setParams]=useSearchParams();
  const [sourceYear,setSourceYear]=useState(2026),[options,setOptions]=useState([]),[showYearPicker,setShowYearPicker]=useState(false);
  const [filters,setFilters]=useState(emptyFilters),[candidates,setCandidates]=useState([]),[batch,setBatch]=useState(null);
  const [selected,setSelected]=useState([]),[search,setSearch]=useState(""),[page,setPage]=useState(1);
  const [busy,setBusy]=useState(false),[started,setStarted]=useState(false),[error,setError]=useState("");
  const [result,setResult]=useState(null),[review,setReview]=useState(false),[undoBatch,setUndoBatch]=useState(null),[undoResult,setUndoResult]=useState(null);
  const [history,setHistory]=useState([]),[historyPage,setHistoryPage]=useState(1),[historyTotal,setHistoryTotal]=useState(0),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState("");
  const [revision,setRevision]=useState(0);
  const sequence=useRef(0),historySequence=useRef(0);
  const invalidate=useCallback(()=>{sequence.current++;},[]);
  const invalidateHistory=useCallback(()=>{historySequence.current++;},[]);
  const key=filters.program&&filters.yearLevel&&filters.section?`${filters.program}:${filters.yearLevel}:${filters.section}`:"";
  const scope=key?scopeOf(key):null,done=result?.status==="completed",locked=busy||(started&&!done);
  const resultsId=/^[a-f0-9]{24}$/i.test(params.get("result")||"")?params.get("result"):"";
  const openResults=id=>{setParams(previous=>{const next=new URLSearchParams(previous);next.set("result",id);return next;},{replace:true});setRevision(value=>value+1);};
  const closeResults=()=>setParams(previous=>{const next=new URLSearchParams(previous);next.delete("result");return next;},{replace:true});
  const loadHistory=useCallback(async()=>{
    const request=++historySequence.current;setHistoryLoading(true);
    try{const {data}=await api.get("/admin/academic-advancement/history",{params:{page:historyPage}});if(request!==historySequence.current)return;setHistory(data.batches||[]);setHistoryTotal(data.total);setHistoryError("");if(data.page!==historyPage)setHistoryPage(data.page);}
    catch(err){if(request===historySequence.current)setHistoryError(err.response?.data?.message||"Could not load updates.");}
    finally{if(request===historySequence.current)setHistoryLoading(false);}
  },[historyPage]);
  useEffect(()=>{loadHistory();return invalidateHistory;},[loadHistory,invalidateHistory]);
  const prepare=useCallback(async(year,classKey,signal)=>{
    const request=++sequence.current;setError("");
    if(!classKey){setBatch(null);setBusy(false);return;}
    setBusy(true);
    try{const {data}=await api.post("/admin/academic-advancement/preview",{sourceYear:year,classScope:scopeOf(classKey)},{signal});if(request!==sequence.current||signal?.aborted)return;setBatch(data);const included=new Set(data.students.map(student=>student._id));setSelected(previous=>previous.filter(id=>included.has(id)));setResult(null);setStarted(false);}
    catch(err){if(request===sequence.current&&!signal?.aborted)setError(err.response?.data?.message||"Could not load this class.");}
    finally{if(request===sequence.current&&!signal?.aborted)setBusy(false);}
  },[]);
  const loadOptions=useCallback(async(year,signal,preferred="")=>{
    const request=++sequence.current;setBusy(true);setError("");
    try{const {data}=await api.get("/admin/academic-advancement",{params:year?{sourceYear:year}:{},signal});if(request!==sequence.current||signal?.aborted)return;
      const current=data.selectedSourceYear??data.currentSchoolYear,available=data.classes||[],chosen=preferred||(available.length===1?available[0].key:"");
      setOptions(data.sourceYears);setSourceYear(current);setCandidates(data.students||[]);setFilters(chosen?{...scopeOf(chosen),yearLevel:String(scopeOf(chosen).yearLevel)}:emptyFilters());setBatch(null);setPage(1);setSearch("");await prepare(current,chosen,signal);
    }catch(err){if(request===sequence.current&&!signal?.aborted){setError(err.response?.data?.message||"Could not load students.");setBusy(false);}}
  },[prepare]);
  useEffect(()=>{const controller=new AbortController();loadOptions(undefined,controller.signal);return()=>{controller.abort();invalidate();};},[loadOptions,invalidate]);
  const changeFilters=next=>{setFilters(next);setSelected([]);setBatch(null);setResult(null);setUndoResult(null);setStarted(false);setReview(false);setPage(1);prepare(sourceYear,next.program&&next.yearLevel&&next.section?`${next.program}:${next.yearLevel}:${next.section}`:"");};
  const students=batch?.students||[],selectedSet=new Set(selected);
  const action=student=>!selectedSet.has(student._id)?"Unchanged":student.yearLevel===4?"Graduate":"Advance";
  const counts=students.reduce((out,student)=>{out[action(student)]++;return out;},{Advance:0,Graduate:0,Unchanged:0});
  const rows=(key?students:candidates).filter(student=>(!filters.program||student.program===filters.program)&&(!filters.yearLevel||student.yearLevel===Number(filters.yearLevel))&&(!filters.section||student.section===filters.section)&&`${student.name} ${student.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const currentPage=Math.min(page,Math.max(1,Math.ceil(rows.length/5))),visible=rows.slice((currentPage-1)*5,currentPage*5);
  const apply=async()=>{
    if(busy||!batch?.batchId||!selected.length)return;
    setBusy(true);setStarted(true);setError("");setUndoResult(null);
    try{const {data}=await api.post(`/admin/academic-advancement/${batch.batchId}/confirm`,{confirmed:true,retainedIds:[],selectedIds:selected,graduateIds:students.filter(student=>student.yearLevel===4&&selectedSet.has(student._id)).map(student=>student._id)},{timeout:120000});
      setResult(data);setRevision(value=>value+1);if(data.status==="completed")setCandidates(previous=>previous.filter(student=>!selectedSet.has(student._id)||data.issues.some(issue=>issue.studentId===student._id)));onApplied?.();await loadHistory();
    }catch(err){setError(err.response?.data?.message||"Could not confirm the result. Retry the same selection safely.");}finally{setBusy(false);setReview(false);}
  };
  const prepareUndo=async item=>{if(busy)return;setBusy(true);setError("");try{const {data}=await api.get(`/admin/academic-advancement/${item.batchId}/undo-preview`);setUndoBatch({...data.batch,reconciliation:data.reconciliation});}catch(err){setError(err.response?.data?.message||"Could not review undo.");}finally{setBusy(false);}};
  const undo=async()=>{if(busy||!undoBatch)return;setBusy(true);setError("");try{const {data}=await api.post(`/admin/academic-advancement/${undoBatch.batchId}/undo`,{confirmed:true,...(undoBatch.reconciliation?.length?{reconcileStudentIds:undoBatch.reconciliation.map(student=>student.studentId)}:{})},{timeout:120000});setUndoResult(data);setRevision(value=>value+1);setSelected([]);setResult(null);setStarted(false);onApplied?.();await loadHistory();await loadOptions(sourceYear,undefined,key);}catch(err){setError(err.response?.data?.message||"Could not finish undo. Retry safely.");await loadHistory();}finally{setBusy(false);setUndoBatch(null);}};
  return <div className="academic-update space-y-4">
    <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-on">Advance year levels</h2>{options.length>1&&<Button size="sm" variant="ghost" disabled={locked} onClick={()=>setShowYearPicker(value=>!value)}>Change school year</Button>}</div>
      <p className="mt-1 text-sm text-on-dim">Filter a class, then check the students to advance. Unchecked students stay unchanged.</p>
      <div className="academic-filter-bar"><div className="academic-filter-search"><label htmlFor="academic-student-search">Search student</label><div className="relative"><FaSearch className="academic-search-icon" aria-hidden="true"/><input id="academic-student-search" type="search" className="field" placeholder="Student name or email" disabled={busy} value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></div></div>
        <div className="academic-filter-program"><label htmlFor="academic-program">Program</label><select id="academic-program" className="field-select" value={filters.program} disabled={locked} onChange={event=>changeFilters({...filters,program:event.target.value})}><option value="">All programs</option>{["BSIT","BSCS","BSEMC"].map(value=><option key={value}>{value}</option>)}</select></div>
        <div><label htmlFor="academic-year-level">Year level</label><select id="academic-year-level" className="field-select" value={filters.yearLevel} disabled={locked} onChange={event=>changeFilters({...filters,yearLevel:event.target.value})}><option value="">All years</option>{[1,2,3,4].map(value=><option key={value} value={value}>Year {value}</option>)}</select></div>
        <div><label htmlFor="academic-section">Section</label><select id="academic-section" className="field-select" value={filters.section} disabled={locked} onChange={event=>changeFilters({...filters,section:event.target.value})}><option value="">All</option>{["A","B","C"].map(value=><option key={value}>{value}</option>)}</select></div>
      </div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-on-muted"><span>Update for {schoolYear(sourceYear+1)}</span>{showYearPicker&&<select aria-label="From school year" className="field-select" value={sourceYear} disabled={locked} onChange={event=>{setSelected([]);setResult(null);setStarted(false);loadOptions(Number(event.target.value));}}>{options.map(year=><option key={year} value={year}>{year}–{year+1}</option>)}</select>}{(search||key||filters.program||filters.yearLevel||filters.section)&&<Button size="sm" variant="ghost" aria-label="Clear search and filters" disabled={locked} onClick={()=>{setSearch("");changeFilters(emptyFilters());}}>Clear</Button>}</div>
    </Card>
    {error&&<div className="alert alert-danger" role="alert">{error}{!started&&!busy&&<Button size="sm" variant="ghost" onClick={()=>loadOptions(sourceYear,undefined,key)}>Retry</Button>}</div>}
    {busy&&!batch&&<p role="status" className="text-sm text-on-muted">Loading students...</p>}
    {undoResult&&<Card role="status"><h3 className="font-semibold text-on">{undoResult.status==="undone"?"Academic update undone":"Undo needs attention"}</h3><p className="mt-2 text-sm text-on-dim">{undoResult.undo.counts.restored} students restored to their previous academic standing.{undoResult.undo.counts.skipped>0&&` ${undoResult.undo.counts.skipped} changed records were left untouched.`}</p><PaginatedList items={undoResult.undo.issues} label="Undo issue pages" className="space-y-2 text-sm" renderItem={item=><li key={item.studentId}>{item.name}: {item.message}</li>}/></Card>}
    {result&&<Card role="status" className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-on">{done?"Academic update completed":"Some records need another attempt"}</h3><p className="mt-1 text-sm text-on-dim">{countsText(result)}</p></div><Button size="icon" variant="secondary" title="View results" aria-label="View results for latest update" disabled={busy} onClick={()=>openResults(result.batchId)}><FaEye/></Button></Card>}
    {!done&&(!busy||batch)&&<Card padding="none" className="academic-masterlist"><div className="academic-list-heading"><div><h3 className="font-semibold text-on">{scope?label(scope):"Students"} <span className="academic-list-count">{key?students.length:rows.length}</span></h3><p className="mt-1 text-xs text-on-dim">{key?"Check all to select the class, then uncheck exceptions.":"Choose Program, Year level and Section to enable an update."}</p></div>{key&&<Button size="sm" variant="ghost" disabled={busy||started} onClick={()=>prepare(sourceYear,key)}><FaSyncAlt/>Refresh</Button>}</div>
      {key&&students.length>0&&<label className="academic-check-all"><input type="checkbox" aria-label="Check all students in this class" checked={selected.length===students.length} disabled={locked} ref={node=>{if(node)node.indeterminate=selected.length>0&&selected.length<students.length;}} onChange={event=>setSelected(event.target.checked?students.map(student=>student._id):[])}/><strong>Check all</strong><span>All {students.length} students, across every page</span></label>}
      <div className="academic-roster-head" aria-hidden="true"><span>Student</span><span>Current year</span><span>{key?"After update":"Program"}</span><span>{key?"Select":"Section"}</span></div>
      <ul className="academic-roster" aria-label={key?"Students in this update":"Students matching filters"}>{visible.map(student=><li key={student._id} className={`academic-roster-row${selectedSet.has(student._id)?" is-selected":""}`}><div className="academic-student"><p className="font-medium text-on">{student.name}</p><p className="text-xs text-on-muted">{student.email}</p></div><div className="academic-current"><span className="academic-mobile-caption">Current</span><span>Year {student.yearLevel}</span><small>{student.program} · {student.section}</small></div><div className="academic-next"><span className="academic-mobile-caption">{key?"After update":"Program"}</span><span className="academic-year-badge">{!key?student.program:action(student)==="Graduate"?"Graduated":`Year ${student.yearLevel+(action(student)==="Advance"?1:0)}`}</span></div><div className="academic-exception">{key?<label><input type="checkbox" disabled={locked} aria-label={`${student.yearLevel===4?"Graduate":"Advance"} ${student.name}`} checked={selectedSet.has(student._id)} onChange={()=>setSelected(previous=>previous.includes(student._id)?previous.filter(id=>id!==student._id):[...previous,student._id])}/><span>{student.yearLevel===4?"Graduate":"Advance"}</span></label>:<span>Section {student.section}</span>}</div></li>)}</ul>
      {!rows.length&&<p className="px-5 py-6 text-sm text-on-muted">No students match these filters.</p>}
      <div className="academic-list-bottom"><Pagination page={currentPage} pageSize={5} total={rows.length} onChange={setPage} disabled={busy} label={key?"Academic masterlist pages":"Student search pages"}/></div>
      {key&&students.length>0&&<div className="academic-review-bar"><div><p className="academic-summary"><span><strong>{counts.Advance}</strong> advance</span><span><strong>{counts.Graduate}</strong> graduate</span><span><strong>{counts.Unchanged}</strong> unchanged</span></p><p className="mt-1 text-xs text-on-muted">Only checked students will change. Search does not change the selection.</p></div><Button disabled={busy||!selected.length} loading={busy} onClick={()=>started?apply():setReview(true)}>{started?"Retry same batch":"Review changes"}</Button></div>}
    </Card>}
    <Card as="section" aria-label="Recent bulk updates" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-on">Recent bulk updates</h3><Button size="sm" variant="ghost" disabled={busy||historyLoading} onClick={loadHistory}>Refresh history</Button></div>{historyError&&<p role="alert" className="text-danger">{historyError}</p>}{!history.length?<p className="text-sm text-on-muted">{historyLoading?"Loading updates...":"No active year updates. Fully undone updates are removed from this list."}</p>:<ul className="space-y-3">{history.map(item=><li key={item.batchId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card-alt/40 p-3"><div className="min-w-0 text-sm"><p className="font-medium text-on">{label(item.classScope)}</p><p className="mt-1 text-xs text-on-muted">{schoolYear(item.sourceYear)} → {schoolYear(item.targetYear)} · {formatDateTime(item.createdAt)}</p><p className="mt-1 text-xs text-on-dim">{item.status==="undo_partial"?"Undo needs attention":item.status} · {countsText(item)}</p></div><div className="flex gap-2"><Button size="icon" variant="secondary" title="View results" aria-label={`View results for ${label(item.classScope)} from ${item.sourceYear}`} disabled={busy} onClick={()=>openResults(item.batchId)}><FaEye/></Button>{["completed","partial","reverting","undo_partial"].includes(item.status)&&<Button size="sm" variant="secondary" disabled={busy} aria-label={`Undo ${label(item.classScope)} update from ${item.sourceYear} to ${item.targetYear}`} onClick={()=>prepareUndo(item)}><FaUndo/>{item.status==="undo_partial"?"Retry undo":"Undo update"}</Button>}</div></li>)}</ul>}<Pagination page={historyPage} pageSize={5} total={historyTotal} onChange={setHistoryPage} disabled={historyLoading||busy} label="Bulk update history pages"/></Card>
    {resultsId&&<AcademicResultsDialog key={resultsId} batchId={resultsId} revision={revision} fallback={result} disabled={busy} onClose={closeResults} onUndo={item=>{closeResults();prepareUndo(item);}}/>}
    <ConfirmDialog open={review} title="Confirm academic advancement?" confirmLabel="Confirm advancement" variant="primary" busy={busy} onCancel={()=>setReview(false)} onConfirm={apply} message={`${label(scope)} only. ${counts.Advance} advance, ${counts.Graduate} graduate, ${counts.Unchanged} stay completely unchanged.`}><PaginatedList items={students.filter(student=>selectedSet.has(student._id))} label="Academic selection review pages" className="space-y-2 text-sm" renderItem={student=><li key={student._id}>{student.name}: Year {student.yearLevel} → {student.yearLevel===4?"Graduated":`Year ${student.yearLevel+1}`}</li>}/></ConfirmDialog>
    <ConfirmDialog open={!!undoBatch} title={undoBatch?.reconciliation?.length?"Finish incomplete undo?":"Undo this academic update?"} confirmLabel={undoBatch?.reconciliation?.length?"Finish undo":"Undo update"} busy={busy} onCancel={()=>setUndoBatch(null)} onConfirm={undo} message={undoBatch?.reconciliation?.length?`${undoBatch.reconciliation.length} students already have their previous year level. Finish undo also restores their previous school-year assignment. Other academic edits remain protected.`:"Restore only students changed by this update. Later academic edits remain protected."}><PaginatedList items={undoBatch?.reconciliation||[]} label="Undo recovery students" className="space-y-3 text-sm" renderItem={student=><li key={student.studentId}><strong>{student.name}</strong><p className="text-xs text-on-muted">{student.email}</p><p>Keep Year {student.yearLevel} · {schoolYear(student.fromSchoolYear)} → {schoolYear(student.toSchoolYear)}</p></li>}/></ConfirmDialog>
  </div>;
}
