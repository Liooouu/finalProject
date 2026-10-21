import React from "react";
import StatusChip from "../ui/StatusChip";

/**
 * Legacy badge kept as a thin alias of StatusChip. Every status surface now
 * shares the same labelled, token-based treatment (never color alone).
 */
const StatusBadge = ({ status, className = "" }) => (
  <StatusChip status={status} className={className} />
);

export default StatusBadge;
