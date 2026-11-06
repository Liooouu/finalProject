import React, { useState } from "react";
import api from "../../api/axios";
import { FaFileAlt } from "react-icons/fa";

export default function PrivateAttachment({ src, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    if (busy) return;
    const name = /^\/uploads\/([A-Za-z0-9_-]+\.(?:pdf|docx?|jpe?g|png))$/i.exec(src || "")?.[1];
    if (!name) { setError("Attachment unavailable."); return; }
    const tab = window.open("about:blank", "_blank");
    if (tab) { tab.opener = null; tab.document.body.textContent = "Opening your attachment..."; }
    setBusy(true); setError("");
    try {
      const { data } = await api.get(`/files/${name}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      if (/\.(?:doc|docx)$/i.test(name)) { tab?.close(); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); }
      else if (tab) tab.location.replace(url);
      else { const link = document.createElement("a"); link.href = url; link.download = name; link.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    } catch { tab?.close(); setError("Could not open attachment. Please retry."); }
    finally { setBusy(false); }
  };
  return <span><button type="button" className="excuse-file-link" onClick={open} disabled={busy}><FaFileAlt aria-hidden="true" />{busy ? "Opening..." : children}</button>{error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}</span>;
}
