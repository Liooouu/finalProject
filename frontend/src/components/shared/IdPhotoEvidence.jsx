import React, { useEffect, useId, useRef, useState } from "react";
import { FaExpand, FaIdCard, FaTimes } from "react-icons/fa";
import api from "../../api/axios";
import { Button } from "../ui";
import "../../styles/attendance-reviews.css";

export default function IdPhotoEvidence({ request, autoLoad = false }) {
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState({ id: null, url: "", error: "" });
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef(null);
  const titleId = useId();
  const id = request._id;
  const available = request.hasIdPhoto === true;
  const url = photo.id === id ? photo.url : "";
  const error = photo.id === id ? photo.error : "";
  const shouldLoad = autoLoad || requested;

  useEffect(() => {
    if (!shouldLoad || !available) return undefined;
    const controller = new AbortController();
    let objectUrl;
    api.get(`/id-photo-attendance/requests/${id}/photo`, { responseType: "blob", timeout: 15000, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setPhoto({ id, url: objectUrl, error: "" });
      }).catch(() => {
        if (!controller.signal.aborted) setPhoto({ id, url: "", error: "ID photo unavailable or expired." });
      });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, available, shouldLoad, attempt]);

  useEffect(() => {
    const node = dialog.current;
    if (expanded && url) node?.showModal();
    else if (node?.open) node.close();
    return () => { if (node?.open) node.close(); };
  }, [expanded, url]);

  return <div className="id-review-evidence">
    {url && available ? <>
      <button type="button" className="id-review-photo" onClick={() => setExpanded(true)} aria-label={`Enlarge ID photo for ${request.student?.name || "student"}`}>
        <img src={url} alt="Captured physical school ID" onError={() => setPhoto({ id, url: "", error: "ID photo could not be displayed." })} />
        <span><FaExpand aria-hidden="true" /> Enlarge ID</span>
      </button>
      <dialog ref={dialog} className="id-evidence-dialog" aria-labelledby={titleId} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
        <div className="id-evidence-dialog-content">
          <div className="flex items-center justify-between gap-3"><h3 id={titleId} className="font-semibold text-on">{request.student?.name || "Student"} · ID photo</h3><Button type="button" variant="ghost" size="sm" aria-label="Close ID photo" onClick={() => setExpanded(false)}><FaTimes aria-hidden="true" /></Button></div>
          <img src={url} alt="Full captured school ID" />
        </div>
      </dialog>
    </> : <div className="id-review-placeholder">
      <FaIdCard aria-hidden="true" />
      <p role={error ? "alert" : "status"}>{!available ? "ID photo expired" : error || (shouldLoad ? "Loading ID…" : "Private ID photo")}</p>
      {available && (!shouldLoad || error) && <Button type="button" variant="secondary" size="sm" onClick={() => { setPhoto({ id, url: "", error: "" }); setRequested(true); setAttempt(value => value + 1); }}>{error ? "Retry" : "View ID"}</Button>}
    </div>}
  </div>;
}
