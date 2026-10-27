import React, { useCallback, useEffect, useState } from "react";
import {
  FaCamera,
  FaCheck,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaStopCircle,
  FaUserCheck,
} from "react-icons/fa";
import api from "../../api/axios";
import { Button, Card } from "../ui";
import { formatDateTime } from "../../utils/helpers";

// Organizer-side control for the face kiosk. Opening a station mints a token
// and launches the public kiosk page; the organizer keeps this page open to
// watch the live count and close the station when the queue ends.
const CheckInStation = ({ eventId }) => {
  const [sessions, setSessions] = useState([]);
  const [opening, setOpening] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [error, setError] = useState("");
  const [lastUrl, setLastUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/checkin/sessions", { params: { eventId } });
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      // A station list is a convenience; never break the event page over it.
      console.error(err.response?.data || err.message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const openStation = async () => {
    setOpening(true);
    setError("");
    setLastUrl("");

    // Open the tab inside the click so the popup blocker lets it through, then
    // point it at the token URL once the API answers.
    const tab = window.open("", "_blank");

    try {
      const { data } = await api.post("/checkin/sessions", {
        eventId,
        stationLabel: "Main entrance",
      });
      const url = `${window.location.origin}/check-in/${data.token}`;
      setLastUrl(url);
      if (tab) {
        tab.location.replace(url);
      }
      await load();
    } catch (err) {
      if (tab) tab.close();
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Could not open the check-in station"
      );
    } finally {
      setOpening(false);
    }
  };

  const closeStation = async (id) => {
    setClosingId(id);
    setError("");
    try {
      await api.delete(`/checkin/sessions/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not close the station");
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight text-on">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
            <FaCamera />
          </span>
          Face check-in station
        </h3>
        <Button onClick={openStation} loading={opening} size="sm">
          <FaExternalLinkAlt /> {opening ? "Opening…" : "Open station"}
        </Button>
      </div>

      <p className="text-sm text-on-dim">
        Students walk up to this device and look at the camera — no login and no QR. Keep
        this page open to watch the count, and close the station when the queue ends.
      </p>

      {lastUrl && (
        <div className="mt-3 rounded-xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm">
          <p className="font-medium text-on">Station opened.</p>
          <p className="mt-1 text-on-dim">If the new tab was blocked, open it here:</p>
          <a
            href={lastUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 font-medium text-brand underline-offset-2 hover:underline"
          >
            <FaExternalLinkAlt className="text-xs" /> Open the check-in station
          </a>
          <p className="mt-2 text-xs text-on-muted">
            The link stays valid until the attendance window closes. Anyone with it can open the
            kiosk, so keep it on the organizer&apos;s device.
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-4" role="alert">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-card-alt/30 px-4 py-5 text-center text-sm text-on-dim">
            No station is open for this event.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-card-alt/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ok/10 text-ok ring-1 ring-inset ring-ok/20">
                  <FaUserCheck />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-on">
                    {session.stationLabel || "Check-in station"}
                  </p>
                  <p className="mt-0.5 text-xs text-on-dim">
                    Opened {formatDateTime(session.createdAt)} · Expires{" "}
                    {formatDateTime(session.expiresAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="num text-lg font-semibold text-on">{session.matchCount || 0}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-on-muted">checked in</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => closeStation(session.id)}
                  loading={closingId === session.id}
                >
                  <FaStopCircle /> Close
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-card-alt/30 p-3.5 text-xs text-on-dim">
        <FaCheck className="mt-0.5 shrink-0 text-ok" />
        <p>
          A student the camera cannot recognise can still be marked by hand in the attendance
          list below — face check-in never blocks a legitimate student.
        </p>
      </div>
    </Card>
  );
};

export default CheckInStation;
