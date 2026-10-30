import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { formatDateTime } from "../../utils/helpers";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { Card, Button } from "../ui";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";

export default function ManualAttendanceHistory() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ requests: [], total: 0, loading: true, error: false });
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const { data } = await api.get("/manual-attendance/requests", { params: { view: "mine", status: "all", page, limit: 3 } });
      if (current === requestId.current) {
        if (page > 1 && !(data.requests || []).length && data.total > 0) setPage(Math.max(1, Math.ceil(data.total / 3)));
        setState({ requests: data.requests || [], total: data.total || 0, loading: false, error: false });
      }
    } catch {
      if (current === requestId.current) setState(previous => ({ ...previous, loading: false, error: true }));
    }
  }, [page]);
  useEffect(() => {
    const sequence = requestId;
    const timer = setTimeout(load, 0);
    return () => { clearTimeout(timer); sequence.current++; };
  }, [load]);
  useAutoRefresh(load, { interval: 30000 });
  useEffect(() => {
    if (window.location.hash === "#manual-requests") document.getElementById("manual-requests")?.scrollIntoView({ block: "start" });
  }, []);
  return <Card as="section" id="manual-requests" className="scroll-mt-6">
    <h2 className="panel-heading">Manual attendance requests</h2>
    <p className="mt-1 text-sm text-on-muted">Check-in time and review time are recorded separately. All times are Philippine time.</p>
    {state.error && <div role="alert" className="alert alert-danger mt-3">Requests could not be refreshed. <Button variant="secondary" size="sm" onClick={load}>Try again</Button></div>}
    <StablePage pageKey={`student-manual:${state.total}`} footer={<Pagination page={page} pageSize={3} total={state.total} onChange={setPage} label="Manual attendance request pages" />}>
    {state.loading ? <p role="status" className="mt-3 text-sm text-on-muted">Loading requests…</p> : !state.requests.length ? <p className="mt-3 text-sm text-on-muted">No manual attendance requests yet.</p> : <ul className="mt-4 space-y-3">{state.requests.map(request => <li key={request._id} className="portal-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 font-medium text-on [overflow-wrap:anywhere]">{request.event?.title || "Event unavailable"}</h3><span className={`rounded-full px-2 py-1 text-xs font-medium ${request.status === "approved" ? "bg-ok/10 text-ok" : request.status === "rejected" ? "bg-danger/10 text-danger" : "bg-info/10 text-info"}`}>{request.status === "pending" ? "Awaiting review" : request.status === "approved" ? "Approved" : "Rejected"}</span></div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-on-muted">{request.proposedStatus === "absent" ? "Attendance cutoff" : request.mode === "correction" ? "Claimed check-in" : "Recorded check-in"}</dt><dd className="mt-1 text-on-dim">{formatDateTime(request.effectiveAt) || "Not applicable"}</dd></div><div><dt className="text-xs text-on-muted">Submitted</dt><dd className="mt-1 text-on-dim">{formatDateTime(request.submittedAt)}</dd></div></dl>
      <p className="mt-3 text-sm text-on-dim">Proposed result: <span className="capitalize">{request.proposedStatus}</span> · {request.proposedHours || 0} penalty hours{request.status === "pending" ? " if approved" : ""}</p>
      <details className="mt-3 text-sm text-on-dim"><summary className="cursor-pointer text-brand">Request details</summary><p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{request.reason}</p><p className="mt-2">Submitted by {request.requestedBy?.name || "Organizer"}</p>{request.reviewedAt && <p className="mt-2">Reviewed: {formatDateTime(request.reviewedAt)} · {request.reviewedBy?.name || "Reviewer"}</p>}{(request.reviewNote || request.note) && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">Review note: {request.reviewNote || request.note}</p>}</details>
    </li>)}</ul>}
    </StablePage>
  </Card>;
}
