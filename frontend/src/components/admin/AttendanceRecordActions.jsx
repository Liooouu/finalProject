import React, { useState } from "react";
import { FaTrashAlt } from "react-icons/fa";
import api from "../../api/axios";
import { clearScreens } from "../../utils/queryCache";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
// Selection is limited to the visible page. Parents key this by page/filter scope.
export default function AttendanceRecordActions({ records, onDeleted, loading = false, children }) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState([]);
  const available = records.filter(record => record._id);
  const selected = available.filter(record => selectedIds.includes(record._id));
  const toggle = id => setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  const checkbox = record => <input type="checkbox" className="attendance-record-checkbox" aria-label={`Select attendance for ${record.student?.name || "student"} at ${record.event?.title || record.eventTitle || "event"}`} checked={selectedIds.includes(record._id)} disabled={busy || loading || !record._id} onChange={() => toggle(record._id)} />;
  const selectAll = <input type="checkbox" className="attendance-record-checkbox" aria-label="Select all records on this page" checked={available.length > 0 && selected.length === available.length} disabled={busy || loading || !available.length} onChange={event => setSelectedIds(event.target.checked ? available.map(record => record._id) : [])} />;
  const remove = async () => {
    if (busy || !selected.length) return;
    setBusy(true); setNotice(""); setErrors([]);
    let removed = 0;
    const failed = [];
    // Each record retains its own authorization, review lock and recovery copy.
    for (const record of selected) {
      try { await api.delete(`/reports/attendance/${record._id}`); removed++; }
      catch (error) {
        failed.push({ id: record._id, message: `${record.student?.name || "Student"} - ${record.event?.title || record.eventTitle || "Event"}: ${error.response?.data?.message || "Could not delete; refresh and try again."}` });
      }
    }
    setConfirming(false);
    setSelectedIds(failed.map(item => item.id));
    setErrors(failed.map(item => item.message));
    setNotice(removed ? `${removed} attendance record${removed === 1 ? "" : "s"} deleted.` : "");
    if (!failed.length) setSelecting(false);
    if (removed) {
      clearScreens();
      try { await onDeleted?.(); }
      catch { setErrors(items => [...items, "Records were deleted. Refresh the list to load updated totals."]); }
    }
    setBusy(false);
  };
  return <>
    <div className="attendance-record-toolbar">
      {selecting ? <>
        <label className="attendance-select-page">{selectAll}<span>Select this page</span></label>
        <span className="text-xs text-on-muted" aria-live="polite">{selected.length} selected</span>
        <div className="attendance-record-toolbar-actions">
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setSelecting(false); setSelectedIds([]); setErrors([]); }}>Cancel</Button>
          <Button type="button" size="sm" variant="danger" disabled={busy || loading || !selected.length} onClick={() => setConfirming(true)}><FaTrashAlt aria-hidden="true" />{busy ? "Deleting..." : `Delete selected (${selected.length})`}</Button>
        </div>
      </> : <Button type="button" size="sm" variant="secondary" disabled={loading || !available.length} onClick={() => { setSelecting(true); setNotice(""); setErrors([]); }}><FaTrashAlt aria-hidden="true" />Delete records</Button>}
    </div>
    {notice && <p role="status" className="px-4 pb-3 text-sm text-ok">{notice}</p>}
    {!!errors.length && <ul role="alert" className="px-4 pb-3 text-sm text-danger">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    {children({ selecting, checkbox, busy })}
    <ConfirmDialog open={confirming} title={`Delete ${selected.length} attendance record${selected.length === 1 ? "" : "s"}?`} confirmLabel={busy ? "Deleting..." : "Delete selected"} busy={busy} onCancel={() => setConfirming(false)} onConfirm={remove} message="This removes the selected records and their service-hour contributions from reports and student ledgers.">
      <ul className="mt-3 space-y-3 text-sm text-on-dim">
        {selected.map(record => (
          <li key={record._id} className="break-words [overflow-wrap:anywhere]">
            <p><span className="font-medium text-on">Student:</span> {record.student?.name || "Student"}</p>
            <p><span className="font-medium text-on">Event:</span> {record.event?.title || record.eventTitle || "Event"}</p>
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  </>;
}
