import React from "react";

/**
 * StatusPill — colored pill badge for status labels.
 * Maps a status string to a Tailwind color variant using the theme's existing
 * color tokens. Supports an optional trailing `hint` rendered as muted text
 * beside the pill (e.g. "Absent" pill + "8 hrs" hint).
 */
const variants = {
  present: "bg-green-500/20 text-green-400",
  attended: "bg-green-500/20 text-green-400",
  approved: "bg-green-500/20 text-green-400",
  available: "bg-green-500/20 text-green-400",
  live: "bg-green-500/20 text-green-400",

  absent: "bg-red-500/20 text-red-400",
  rejected: "bg-red-500/20 text-red-400",
  closed: "bg-red-500/20 text-red-400",

  late: "bg-yellow-500/20 text-yellow-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  excused: "bg-yellow-500/20 text-yellow-400",
  upcoming: "bg-blue-500/20 text-blue-400",

  info: "bg-gray-500/20 text-gray-300",
  unknown: "bg-gray-500/20 text-gray-300",
};

const labels = {
  attended: "Attended",
  approved: "Approved",
  rejected: "Rejected",
  excused: "Excused",
  upcoming: "Upcoming",
};

const StatusPill = ({ status, hint, className = "" }) => {
  const key = (status || "").toLowerCase();
  const palette = variants[key] || variants.info;
  const label = labels[key] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown");

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${palette}`}
      >
        {label}
      </span>
      {hint && (
        <span className="text-xs text-on-muted whitespace-nowrap">{hint}</span>
      )}
    </span>
  );
};

export default StatusPill;
