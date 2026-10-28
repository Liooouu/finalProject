import React from "react";
import { formatDateTime } from "../../utils/helpers";

export default function EventLastEdit({ event, className = "" }) {
  if (!event?.lastEditedAt) return null;
  return <p className={`text-xs text-on-muted [overflow-wrap:anywhere] ${className}`}>Last edited by <span className="font-medium text-on-dim">{event.lastEditedByName || event.lastEditedBy?.name || "Staff member"}</span> · {formatDateTime(event.lastEditedAt)}</p>;
}
