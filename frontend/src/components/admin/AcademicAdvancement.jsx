import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { Button, Card } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import PaginatedList from "../ui/PaginatedList";
import { FaArrowRight, FaSearch, FaSyncAlt, FaCheckCircle, FaUndo } from "react-icons/fa";
import { formatDateTime } from "../../utils/helpers";
import "../../styles/academic-advancement.css";

const yearLabel = year => `S.Y. ${year}–${year + 1}`;
const PAGE_SIZE = 5;

export default function AcademicAdvancement({ onApplied }) {
  const [options, setOptions] = useState([]);
  const [sourceYear, setSourceYear] = useState(2026);
  const [batch, setBatch] = useState(null);
  const [retained, setRetained] = useState([]);
  const [graduates, setGraduates] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [undoBatch, setUndoBatch] = useState(null);
  const [undoResult, setUndoResult] = useState(null);
  const undoFeedback = useRef(null);
  const errorFeedback = useRef(null);
  const historySequence = useRef(0);
  const requestSequence = useRef(0);

  const loadHistory = useCallback(async () => {
    const sequence = ++historySequence.current;
    setHistoryLoading(true);
    try {
      const { data } = await api.get("/admin/academic-advancement/history", { params: { page: historyPage } });
      if (sequence !== historySequence.current) return;
      setHistory(Array.isArray(data.batches) ? data.batches : []);
      setHistoryTotal(data.total || 0); setHistoryError("");
      if (data.page && data.page !== historyPage) setHistoryPage(data.page);
    } catch (err) {
      if (sequence === historySequence.current) setHistoryError(err.response?.data?.message || "Could not load recent updates. Try again.");
    } finally { if (sequence === historySequence.current) setHistoryLoading(false); }
  }, [historyPage]);
  useEffect(() => { loadHistory(); return () => { historySequence.current += 1; }; }, [loadHistory]);
  useEffect(() => {
    if (busy) return;
    const target = error ? errorFeedback.current : undoResult ? undoFeedback.current : null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [busy, error, undoResult]);

  const prepare = useCallback(async (year, signal) => {
    const request = ++requestSequence.current;
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/admin/academic-advancement/preview", { sourceYear: year }, { signal });
      if (request !== requestSequence.current || signal?.aborted) return;
      setBatch(data);
      const included = new Set(data.students.map(student => student._id));
      setRetained(previous => previous.filter(id => included.has(id)));
      setGraduates(previous => previous.filter(id => included.has(id)));
      setResult(null); setStarted(false); setPage(1); setSearch("");
    } catch (err) {
      if (request === requestSequence.current && !signal?.aborted) setError(err.response?.data?.message || "Could not load the masterlist. Please try again.");
    } finally { if (request === requestSequence.current && !signal?.aborted) setBusy(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    api.get("/admin/academic-advancement", { signal: controller.signal }).then(async ({ data }) => {
      if (controller.signal.aborted) return;
      setOptions(data.sourceYears);
      setSourceYear(data.currentSchoolYear);
      await prepare(data.currentSchoolYear, controller.signal);
    }).catch(() => {
      if (!controller.signal.aborted) { setError("Could not load school years. Reopen this tab to try again."); setBusy(false); }
    });
    return () => { controller.abort(); requestSequence.current += 1; };
  }, [prepare]);
  const apply = async () => {
    if (busy) return;
    setBusy(true); setStarted(true); setError("");
    try {
      const { data } = await api.post(`/admin/academic-advancement/${batch.batchId}/confirm`, {
        confirmed: true, retainedIds: retained, graduateIds: graduates,
      }, { timeout: 120000 });
      setResult(data);
      onApplied?.();
      await loadHistory();
    } catch (err) { setError(err.response?.data?.message || "The result could not be confirmed. Retry this same batch; saved students will not advance twice."); }
    finally { setBusy(false); setReview(false); }
  };
  const undoUpdate = async () => {
    if (busy || !undoBatch) return;
    setBusy(true); setError(""); setUndoResult(null);
    try {
      const { data } = await api.post(`/admin/academic-advancement/${undoBatch.batchId}/undo`, { confirmed: true }, { timeout: 120000 });
      setUndoResult(data);
      onApplied?.();
      await loadHistory();
      // Undo restores eligibility. Reload a fresh preview; never reuse the old
      // confirmed roster or automatically advance the restored students again.
      setRetained([]); setGraduates([]);
      await prepare(sourceYear);
    } catch (err) {
      setError(err.response?.data?.message || "Undo could not be confirmed. Retry undo from recent updates; restored students will not change again.");
      await loadHistory();
    } finally { setBusy(false); setUndoBatch(null); }
  };
  const toggle = (setter, id) => setter(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  const students = batch?.students || [];
  const matching = students.filter(student => `${student.name} ${student.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matching.length / PAGE_SIZE)));
  const visible = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const action = student => graduates.includes(student._id) ? "Graduate" : retained.includes(student._id) || student.yearLevel === 4 ? "Retain" : "Advance";
  const counts = students.reduce((summary, student) => ({ ...summary, [action(student)]: summary[action(student)] + 1 }), { Advance: 0, Retain: 0, Graduate: 0 });
  const locked = busy || started;
  const done = result?.status === "completed";

  return <div className="academic-update space-y-4">
    <Card className="academic-year-panel">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-on">Move students to the next school year</h2>
        {options.length > 1 && <Button size="sm" variant="ghost" disabled={busy || started} onClick={() => setShowYearPicker(value => !value)}>{showYearPicker ? "Done" : "Change school year"}</Button>}
      </div>
      <p className="mt-1 text-sm text-on-dim">Review the masterlist, choose who stays in their year level, then confirm.</p>
      <div className="academic-year-controls">
        <div className="academic-year-field"><span>From school year</span>
          {showYearPicker ? <select aria-label="From school year" className="field-select" value={sourceYear} disabled={busy || (started && !done) || !options.length} onChange={event => {
            const year = Number(event.target.value); setSourceYear(year); setBatch(null); setRetained([]); setGraduates([]); setResult(null); setStarted(false); prepare(year);
          }}>
            {options.map(year => <option key={year} value={year}>{year}–{year + 1}</option>)}
          </select> : <p className="academic-year-destination academic-year-source">{sourceYear}–{sourceYear + 1}</p>}
        </div>
        <FaArrowRight className="academic-year-arrow" aria-hidden="true" />
        <div className="academic-year-field"><span>To school year</span><p className="academic-year-destination">{sourceYear + 1}–{sourceYear + 2}</p></div>
      </div>
      <p className="academic-year-note">Nothing changes until you confirm. Program, section, and past records stay the same.</p>
    </Card>

    {error && <div ref={errorFeedback} tabIndex={-1} className="alert alert-danger" role="alert">{error}{!busy && !started && options.length > 0 && <Button className="ml-3" size="sm" variant="secondary" onClick={() => prepare(sourceYear)}>Retry</Button>}</div>}
    {busy && !batch && <p className="px-1 text-sm text-on-muted" role="status">Loading student masterlist...</p>}
    {undoResult && <Card ref={undoFeedback} tabIndex={-1} role="status" className="space-y-2">
      <h3 className="font-semibold text-on">{undoResult.status === "undone" ? "Academic update undone" : "Undo needs attention"}</h3>
      <p className="text-sm text-on-dim">{undoResult.undo.counts.restored} students restored to their previous academic standing.{undoResult.undo.counts.skipped > 0 && ` ${undoResult.undo.counts.skipped} changed records were left untouched.`}{undoResult.undo.counts.failed > 0 && ` ${undoResult.undo.counts.failed} could not be restored; retry undo.`}</p>
      <PaginatedList key={undoResult.batchId} items={undoResult.undo.issues} label="Undo issue pages" className="space-y-2 text-sm text-on-dim" renderItem={issue => <li key={issue.studentId}><strong>{issue.name}:</strong> {issue.message}</li>} />
    </Card>}
    {result && <Card>
      <h3 className="flex items-center gap-2 font-semibold text-on" role="status">{done && <FaCheckCircle className="text-ok" aria-hidden="true" />}{done ? "Academic update completed" : "Some records need another attempt"}</h3>
      <p className="mt-2 text-sm text-on-dim">{result.counts.advanced} advanced · {result.counts.retained} kept their year · {result.counts.graduated} graduated{result.counts.skipped > 0 && ` · ${result.counts.skipped} skipped`}{result.counts.failed > 0 && ` · ${result.counts.failed} failed`}</p>
      {["completed", "partial"].includes(result.status) && <Button className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={() => setUndoBatch(result)}><FaUndo aria-hidden="true" />Undo this update</Button>}
      {!!result.issues.length && <PaginatedList key={result.batchId} items={result.issues} label="Academic update issue pages" className="mt-3 space-y-2 text-sm text-on-dim" renderItem={issue => <li key={issue.studentId}><strong>{issue.name}:</strong> {issue.message}</li>} />}
    </Card>}

    {batch && !done && !students.length && <Card><h3 className="font-semibold text-on">No students need updating</h3><p className="mt-1 text-sm text-on-dim">Students already processed, graduated, incomplete, or assigned to another school year are excluded.</p><Button className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={() => prepare(sourceYear)}><FaSyncAlt aria-hidden="true" />Refresh</Button></Card>}
    {batch && !done && students.length > 0 && <Card padding="none" className="academic-masterlist">
      <div className="academic-list-heading">
        <div><h3 className="font-semibold text-on">Student masterlist <span className="academic-list-count">{students.length}</span></h3>
          <p className="mt-1 text-xs text-on-dim">Years 1–3 advance by default. Check <strong>Keep year</strong> for exceptions.</p>
        </div>
        <Button size="sm" variant="ghost" disabled={busy || started} onClick={() => prepare(sourceYear)}><FaSyncAlt aria-hidden="true" />Refresh</Button>
        <label className="academic-search"><span className="sr-only">Search student</span><FaSearch aria-hidden="true" />
          <input type="search" className="field" placeholder="Search name or email" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        </label>
      </div>
      <div className="academic-roster-head" aria-hidden="true"><span>Student</span><span>Current year</span><span>After update</span><span>Exception</span></div>
      <ul className="academic-roster" aria-label="Students in this update">
        {visible.map(student => {
          const nextAction = action(student);
          const selected = retained.includes(student._id) || graduates.includes(student._id);
          return <li key={student._id} className={`academic-roster-row${selected ? " is-selected" : ""}`}>
            <div className="academic-student"><p className="font-medium text-on">{student.name}</p><p className="text-xs text-on-muted">{student.email}</p></div>
            <div className="academic-current"><span className="academic-mobile-caption">Current</span><span className="text-sm text-on">Year {student.yearLevel}</span><small>{student.program} · {student.section}</small></div>
            <div className="academic-next"><span className="academic-mobile-caption">After update</span><span className={`academic-year-badge${nextAction === "Retain" ? " is-retained" : ""}`}>{nextAction === "Graduate" ? "Graduated" : `Year ${student.yearLevel + (nextAction === "Advance" ? 1 : 0)}`}</span></div>
            <div className="academic-exception">
              {student.yearLevel === 4 ? <label><input type="checkbox" disabled={locked} checked={graduates.includes(student._id)} onChange={() => toggle(setGraduates, student._id)} /><span>Mark graduated</span></label>
                : <label><input type="checkbox" aria-label={`Keep current year level for ${student.name}`} disabled={locked} checked={retained.includes(student._id)} onChange={() => toggle(setRetained, student._id)} /><span>Keep year</span></label>}
            </div>
          </li>;
        })}
      </ul>
      {!matching.length && <p className="py-8 text-center text-sm text-on-muted">No students match your search.</p>}
      <div className="academic-list-bottom">
        <p className="text-xs text-on-muted">Fourth-year students stay in Year 4 unless marked graduated.{batch.excludedCount > 0 && ` ${batch.excludedCount} ineligible records are excluded.`}</p>
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={matching.length} onChange={setPage} label="Academic masterlist pages" />
      </div>
      <div className="academic-review-bar">
        <div><p className="academic-summary" aria-live="polite"><span><strong>{counts.Advance}</strong> advance</span><span><strong>{counts.Retain}</strong> keep year</span><span><strong>{counts.Graduate}</strong> graduate</span></p>
          <p className="mt-1 text-xs text-on-muted">Applies to all {students.length} students, across every page.</p>
        </div>
        <Button disabled={busy} loading={busy} onClick={() => started ? apply() : setReview(true)}>{busy ? "Saving batch..." : started ? "Retry same batch" : "Review changes"}{!busy && !started && <FaArrowRight aria-hidden="true" />}</Button>
      </div>
    </Card>}
    <Card as="section" aria-label="Recent bulk updates" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-on">Recent bulk updates</h3><Button size="sm" variant="ghost" disabled={busy || historyLoading} onClick={loadHistory}><FaSyncAlt aria-hidden="true" />Refresh history</Button></div>
      <p className="text-xs text-on-dim">Accidental update? Undo restores the previous academic standing. Students edited afterward are skipped for review.</p>
      {historyError && <p role="alert" className="text-sm text-danger">{historyError}</p>}
      {historyLoading && !history.length ? <p role="status" className="text-sm text-on-muted">Loading recent updates...</p> : !history.length ? <p className="text-sm text-on-muted">Your confirmed updates will appear here, including after a page refresh.</p> : <ul className="space-y-3">{history.map(item => {
        const canUndo = ["completed", "partial", "reverting", "undo_partial"].includes(item.status);
        const statusLabel = { completed: "Completed", partial: "Partly completed", running: "Update in progress", reverting: "Undo interrupted · retry available", undo_partial: "Undo needs attention", undone: "Undone" }[item.status] || item.status;
        return <li key={item.batchId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-card-alt/40 p-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium text-on">{yearLabel(item.sourceYear)} → {yearLabel(item.targetYear)}</p><p className="mt-1 text-xs text-on-dim">{statusLabel} · {item.createdAt ? formatDateTime(item.createdAt) : "Saved update"}</p><p className="mt-1 text-xs text-on-muted">{item.counts.advanced} advanced · {item.counts.retained} kept year · {item.counts.graduated} graduated{item.undoneAt && ` · ${item.undo.counts.restored} restored`}</p></div>
          {canUndo && <Button size="sm" variant="secondary" disabled={busy || historyLoading} onClick={() => setUndoBatch(item)} aria-label={`Undo update from ${item.sourceYear} to ${item.targetYear}`}><FaUndo aria-hidden="true" />{["undo_partial", "reverting"].includes(item.status) ? "Retry undo" : "Undo update"}</Button>}
        </li>;
      })}</ul>}
      <Pagination page={historyPage} pageSize={PAGE_SIZE} total={historyTotal} onChange={setHistoryPage} disabled={busy || historyLoading} label="Bulk update history pages" />
    </Card>
    <ConfirmDialog open={review} title="Confirm academic advancement?" variant="primary" confirmLabel="Confirm advancement" busy={busy} onConfirm={apply} onCancel={() => setReview(false)}
      message={`${yearLabel(batch?.sourceYear || sourceYear)} → ${yearLabel(batch?.targetYear || sourceYear + 1)}. ${counts.Advance} advance, ${counts.Retain} keep their year level, and ${counts.Graduate} are marked graduated.`}>
      <PaginatedList key={batch?.batchId} items={students.filter(student => action(student) !== "Advance")} label="Academic exception review pages" disabled={busy} className="space-y-2 text-sm text-on-dim" renderItem={student => <li key={student._id}>{student.name} — {action(student) === "Graduate" ? "Mark graduated" : `Keep Year ${student.yearLevel}`}</li>} />
    </ConfirmDialog>
    <ConfirmDialog open={!!undoBatch} title="Undo this academic update?" confirmLabel="Undo update" busy={busy} onConfirm={undoUpdate} onCancel={() => setUndoBatch(null)}
      message={`Restore students from ${yearLabel(undoBatch?.targetYear || sourceYear + 1)} to their saved standing before this update. Later academic edits are skipped. Attendance, service hours, and organizer access stay unchanged.`} />
  </div>;
}
