import React, { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaUserCheck } from "react-icons/fa";
import api from "../../api/axios";
import { Button, Card } from "../ui";
import Pagination from "../ui/Pagination";

const PAGE_SIZE = 6;
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

export default function EventReviewers({ eventId }) {
  const [enabled, setEnabled] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const current = ++sequence.current;
    if (!enabled) return;
    setLoading(true);
    setLoadError("");
    api.get("/manual-attendance/reviewers", { params: { eventId } }).then(({ data }) => {
      if (current !== sequence.current) return;
      setReviewers(data.reviewers || []);
      setCandidates(data.candidates || []);
      setSelected(new Set((data.reviewers || []).map(user => String(user._id))));
      setPage(1);
    }).catch(error => {
      if (current === sequence.current) setLoadError(errorMessage(error, "Reviewers could not be loaded."));
    }).finally(() => {
      if (current === sequence.current) setLoading(false);
    });
    return () => { sequence.current += 1; };
  }, [enabled, eventId, reload]);

  const save = async () => {
    if (saving || loading || loadError) return;
    const current = sequence.current;
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const { data } = await api.put("/manual-attendance/reviewers", { eventId, userIds: [...selected] });
      if (current !== sequence.current) return;
      const saved = data.reviewers || [];
      setReviewers(saved);
      setSelected(new Set(saved.map(user => String(user._id))));
      setMessage("Reviewers saved for this event.");
    } catch (error) {
      if (current === sequence.current) setSaveError(errorMessage(error, "Reviewers could not be saved."));
    } finally {
      if (current === sequence.current) setSaving(false);
    }
  };

  const filtered = candidates.filter(user => `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <Card>
    <details className="group" onToggle={event => { if (event.currentTarget.open) setEnabled(true); }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-on">
        <FaUserCheck aria-hidden="true" /><span className="flex-1">Manual attendance reviewers</span>
        <FaChevronDown aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      {enabled && <div className="mt-3 space-y-3">
        <p className="text-sm text-on-dim">Admins can review all requests. Optionally assign trusted organizers to help review this event. They cannot approve their own submission or attendance.</p>
        {loading ? <p role="status" className="text-sm text-on-muted">Loading reviewers…</p> : loadError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">{loadError}</p><Button size="sm" variant="secondary" onClick={() => setReload(value => value + 1)}>Try again</Button></div> : <>
          <p className="text-sm text-on-muted [overflow-wrap:anywhere]">Assigned: {reviewers.length ? reviewers.map(user => user.name || user.email).join(", ") : "Administrators only"}</p>
          {candidates.length > PAGE_SIZE && <div><label className="field-label" htmlFor="event-reviewer-search">Find an organizer</label><input id="event-reviewer-search" type="search" className="field" placeholder="Name or email" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} disabled={saving} /></div>}
          <div className="grid gap-2 sm:grid-cols-2">{visible.map(user => <label key={user._id} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl bg-card-alt/50 p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-solid)]" checked={selected.has(String(user._id))} onChange={() => { setSelected(previous => { const next = new Set(previous); const id = String(user._id); if (next.has(id)) next.delete(id); else next.add(id); return next; }); setMessage(""); }} disabled={saving} />
            <span className="min-w-0 text-sm [overflow-wrap:anywhere]"><span className="block font-medium text-on">{user.name || "Organizer"}</span><span className="text-xs text-on-muted">{user.email}</span></span>
          </label>)}</div>
          {!visible.length && <p className="text-sm text-on-muted">{candidates.length ? "No matching organizers." : "No organizers available to assign."}</p>}
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} disabled={saving} label="Event reviewer pages" />
          {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
          {message && <p role="status" className="text-sm text-ok">{message}</p>}
          <Button size="sm" loading={saving} onClick={save}>Save reviewers</Button>
        </>}
      </div>}
    </details>
  </Card>;
}
