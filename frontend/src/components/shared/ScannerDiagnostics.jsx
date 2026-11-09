import React, { useEffect, useState } from "react";

// Only operational state is supplied here: never images, descriptors, URLs,
// credentials, matched names or account IDs.
export default function ScannerDiagnostics({ statusRef }) {
  const [status, setStatus] = useState({ stage: "Reading scanner status" });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setStatus({ ...statusRef.current }); });
    const timer = setInterval(() => setStatus({ ...statusRef.current }), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [statusRef]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(status, null, 2)); setCopied(true); }
    catch { setCopied(false); }
  };
  return <div className="mt-3 space-y-2 text-xs leading-relaxed text-white/70">
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
      <dt>Scanner</dt><dd>{status.stage}</dd>
      <dt>Processing</dt><dd>{status.backend || "Starting"}</dd>
      <dt>Last server result</dt><dd>{status.serverResult || "No face-match request sent yet"}</dd>
      {status.serverReason && <><dt>Last rejection</dt><dd>{status.serverReason}</dd></>}
      {status.reason && <><dt>Reason</dt><dd>{status.reason}</dd></>}
      {status.frame && <><dt>Capture size</dt><dd>{status.frame}</dd></>}
    </dl>
    <button type="button" className="rounded-lg border border-white/20 px-3 py-2 font-medium" onClick={copy}>{copied ? "Copied" : "Copy scanner status"}</button>
    <p className="text-white/45">Contains operational status only. No photo, face signature, account details or station link.</p>
  </div>;
}
