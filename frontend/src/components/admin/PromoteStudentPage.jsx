import React, { useCallback, useEffect, useState } from "react";
import api from "../../api/axios";
import { Button, Card, PageHeader } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import { useAutoRefresh } from "../../utils/useAutoRefresh";

export default function PromoteStudentPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => api.get("/admin/organizer-candidates").then(({ data }) => { setStudents(data); setLoadError(false); setLoading(false); }).catch(() => { setLoadError(true); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  const promote = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.post(`/admin/users/${selected._id}/promote-organizer`);
      setStudents(rows => rows.filter(row => row._id !== selected._id));
      setMessage(`${selected.name} now has student and organizer access. ${data.notificationWarning || "They can switch portals from their account menu using the same login."}`);
      setSelected(null);
    } catch (err) { setError(err.response?.data?.message || "The student could not be promoted."); setSelected(null); if (err.response?.status === 409) load(); }
    finally { setBusy(false); }
  };
  if (loading) return <Loading label="Loading students..." />;
  const term = search.trim().toLowerCase();
  const filtered = students.filter(student => `${student.name} ${student.email} ${student.program || ""} ${student.section || ""}`.toLowerCase().includes(term));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  return <div className="space-y-4">
    <PageHeader title="Promote student" subtitle="Grant organizer access to an existing student. Their student account and records stay available." />
    <Card padding="sm"><label htmlFor="promote-search" className="field-label">Find a student</label><input id="promote-search" type="search" className="field" placeholder="Search name, email, or program" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><p className="mt-2 text-xs text-on-muted">The same email and password work for both portals. No new account is created.</p></Card>
    {loadError && <div role="alert" className="alert alert-danger">The student list could not be refreshed. <Button onClick={load} variant="secondary" size="sm">Try again</Button></div>}
    {message && <div role="status" className="alert alert-ok">{message}</div>}
    {error && <div role="alert" className="alert alert-danger">{error}</div>}
    <Card>{!filtered.length ? <EmptyState compact title={loadError ? "Student list unavailable" : "No eligible students found"} description="Students who already have organizer access are excluded." /> : <ul className="divide-y divide-line">{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(student => <li key={student._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-on [overflow-wrap:anywhere]">{student.name}</p><p className="mt-1 text-xs text-on-dim [overflow-wrap:anywhere]">{student.email}</p><p className="mt-1 text-xs text-on-muted">{student.program || "Program unset"} · Year {student.yearLevel || "–"} · Section {student.section || "–"}{student.enrollmentStatus === "graduated" ? " · Graduated" : ""}</p></div><Button size="sm" variant="secondary" onClick={() => { setError(""); setSelected(student); }} aria-label={`Promote ${student.name}`}>Promote</Button></li>)}</ul>}<Pagination page={currentPage} pageSize={10} total={filtered.length} onChange={setPage} label="Student promotion pages" /></Card>
    <ConfirmDialog open={!!selected} title="Grant organizer access?" message={selected ? `Promote ${selected.name} (${selected.email})? They will be able to manage events and attendance. Their student portal, face enrollment, attendance history, and service ledger will remain available.` : ""} confirmLabel="Promote student" onConfirm={promote} onCancel={() => { if (!busy) setSelected(null); }} busy={busy} />
  </div>;
}
