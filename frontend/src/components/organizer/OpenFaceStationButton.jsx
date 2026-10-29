import React, { useState } from "react";
import { FaCamera } from "react-icons/fa";
import api from "../../api/axios";
import { Button } from "../ui";

export default function OpenFaceStationButton({ eventId }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [blockedStationUrl, setBlockedStationUrl] = useState("");
  const open = async () => {
    if (opening) return;
    setOpening(true); setError(""); setBlockedStationUrl("");
    const tab = window.open("", "_blank");
    try {
      const { data } = await api.post("/checkin/sessions", { eventId, stationLabel: "Main entrance" });
      const url = `${window.location.origin}/check-in/${data.token}`;
      if (tab) tab.location.replace(url);
      else setBlockedStationUrl(url);
    } catch (err) {
      if (tab) tab.close();
      setError(err.response?.data?.error || "Could not open the face station. Try again.");
    } finally { setOpening(false); }
  };
  return <div className="min-w-0">
    <Button onClick={open} loading={opening} size="sm"><FaCamera />{opening ? "Opening…" : "Open face station"}</Button>
    {blockedStationUrl && <p role="alert" className="mt-2 text-xs text-on-muted">Your browser blocked the station tab. <a className="font-medium text-brand underline" href={blockedStationUrl} target="_blank" rel="noreferrer">Open station</a></p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </div>;
}
