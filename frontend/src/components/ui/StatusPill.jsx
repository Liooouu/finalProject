import React from "react";
import StatusChip from "./StatusChip";

/**
 * StatusPill — legacy wrapper around StatusChip so attendance, event and
 * request statuses all read the same across the app. An optional `hint` is
 * rendered as muted text beside the pill (e.g. "Absent" + "8 hrs").
 */
const StatusPill = ({ status, hint, className = "" }) => {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <StatusChip status={status} />
      {hint && (
        <span className="whitespace-nowrap text-xs text-on-muted">{hint}</span>
      )}
    </span>
  );
};

export default StatusPill;
