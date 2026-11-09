import { useTransientState } from "../../utils/useTransientState";
import React, { useState } from "react";
import { FaCamera } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { Button } from "../ui";
import { sessionDayStatus } from "../../utils/attendanceSessions";
import { formatDateTime } from "../../utils/helpers";

const stationDate = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true };

export default function OpenFaceStationButton({ eventId, sessions = [] }) {
  const navigate = useNavigate();
  const [selectedSessionId, setSessionId] = useState("");
  const available = sessions.filter(session => sessionDayStatus(session) !== "finished");
  const sessionId = available.find(session => session._id === selectedSessionId)?._id
    || available.find(session => sessionDayStatus(session) === "live")?._id
    || available[0]?._id;
  const selectedSession = available.find(session => session._id === sessionId);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useTransientState("");
  const [blockedStationUrl, setBlockedStationUrl] = useState("");
  const open = async () => {
    if (opening || (sessions.length && !sessionId)) return;
    setOpening(true); setError(""); setBlockedStationUrl("");
    const openHere = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    const tab = openHere ? null : window.open("", "_blank");
    try {
      const { data } = await api.post("/checkin/sessions", { eventId, sessionId: sessionId || undefined, stationLabel: "Main entrance" });
      const url = `/check-in/${encodeURIComponent(data.token)}`;
      if (openHere) navigate(url);
      else if (tab && !tab.closed) tab.location.replace(new URL(url, window.location.origin).href);
      else setBlockedStationUrl(url);
    } catch (err) {
      if (tab) tab.close();
      setError(err.response?.data?.error || "Could not open the face station. Try again.");
    } finally { setOpening(false); }
  };
  return <div className="min-w-0">
    {sessions.length > 1 && <label className="field-label mb-3">Day / activity<select className="field-select mt-1 w-full" value={sessionId || ""} disabled={opening || !available.length} onChange={e => { setSessionId(e.target.value); setError(""); setBlockedStationUrl(""); }}>{!available.length && <option value="">No days available</option>}{sessions.map(row => {
      const status = sessionDayStatus(row);
      return <option key={row._id} value={row._id} disabled={status === "finished"}>{row.name} · {formatDateTime(row.timeInOpen, { month: "short", day: "numeric" })} · {status === "live" ? "Live" : status === "upcoming" ? "Upcoming" : "Finished"}</option>;
    })}</select></label>}
    {selectedSession && <div className="mb-3 space-y-1 text-xs text-on-muted">
      <p>Time In opens {formatDateTime(selectedSession.timeInOpen, stationDate)}</p>
      <p>Time Out closes {formatDateTime(selectedSession.timeOutClose, stationDate)} · Philippine time</p>
    </div>}
    <Button onClick={open} loading={opening} disabled={sessions.length > 0 && !sessionId} size="sm"><FaCamera />{opening ? "Opening…" : "Open face station"}</Button>
    {blockedStationUrl && <p role="alert" className="mt-2 text-xs text-on-muted">The station tab is unavailable. <Link className="font-medium text-brand underline" to={blockedStationUrl}>Open station here</Link></p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </div>;
}
