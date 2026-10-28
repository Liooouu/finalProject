import React, { useState } from "react";
import { FaCamera } from "react-icons/fa";
import api from "../../api/axios";
import { Button } from "../ui";

export default function OpenFaceStationButton({ eventId }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [stationUrl, setStationUrl] = useState("");
  const open = async () => {
    if (opening) return;
    setOpening(true); setError(""); setStationUrl("");
    const tab = window.open("", "_blank");
    try {
      const { data } = await api.post("/checkin/sessions", { eventId, stationLabel: "Main entrance" });
      const url = `${window.location.origin}/check-in/${data.token}`;
      setStationUrl(url);
      if (tab) tab.location.replace(url);
    } catch (err) {
      if (tab) tab.close();
      setError(err.response?.data?.error || "Could not open the face station. Try again.");
    } finally { setOpening(false); }
  };
  return <div className="min-w-0">
    <Button onClick={open} loading={opening} size="sm"><FaCamera />{opening ? "Opening…" : "Open face station"}</Button>
    {stationUrl && <p className="mt-2 text-xs text-on-muted">Station ready. <a className="font-medium text-brand underline" href={stationUrl} target="_blank" rel="noreferrer">Open station tab</a></p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </div>;
}
