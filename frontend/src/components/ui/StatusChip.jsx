import React from "react";
import {
  FaCheck,
  FaClock,
  FaTimes,
  FaBan,
  FaCalendarAlt,
  FaDotCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaFileMedical,
  FaInfoCircle,
} from "react-icons/fa";

/**
 * StatusChip — color-coded AND labeled/iconed status (never color alone).
 * Covers attendance, excuse, request and event lifecycle statuses using the
 * Aurora semantic tokens so light and dark themes stay in step.
 */
const ok = "bg-ok/10 text-ok ring-ok/25";
const warn = "bg-warn/10 text-warn ring-warn/25";
const danger = "bg-danger/10 text-danger ring-danger/25";
const info = "bg-info/10 text-info ring-info/25";
const excused = "bg-excused/10 text-excused ring-excused/25";
const neutral = "bg-card-alt text-on-dim ring-line";

const configs = {
  present: { label: "Present", icon: <FaCheck />, cls: ok },
  attended: { label: "Attended", icon: <FaCheck />, cls: ok },
  approved: { label: "Approved", icon: <FaCheckCircle />, cls: ok },
  active: { label: "Active", icon: <FaCheckCircle />, cls: ok },
  verified: { label: "Verified", icon: <FaCheckCircle />, cls: ok },
  resolved: { label: "Resolved", icon: <FaCheckCircle />, cls: ok },

  late: { label: "Late", icon: <FaClock />, cls: warn },
  pending: { label: "Pending", icon: <FaHourglassHalf />, cls: neutral },
  open: { label: "Open", icon: <FaDotCircle />, cls: info },
  unverified: { label: "Unverified", icon: <FaHourglassHalf />, cls: warn },

  absent: { label: "Absent", icon: <FaTimes />, cls: danger },
  rejected: { label: "Rejected", icon: <FaTimesCircle />, cls: danger },
  suspended: { label: "Suspended", icon: <FaBan />, cls: danger },
  cancelled: { label: "Cancelled", icon: <FaBan />, cls: danger },

  excused: { label: "Excused", icon: <FaFileMedical />, cls: excused },

  upcoming: { label: "Upcoming", icon: <FaCalendarAlt />, cls: info },
  scheduled: { label: "Scheduled", icon: <FaCalendarAlt />, cls: info },
  live: { label: "Live", icon: <FaDotCircle />, cls: ok },
  // finished = ran to its end time; closed = a person ended it early.
  finished: { label: "Finished", icon: <FaCheckCircle />, cls: neutral },
  closed: { label: "Closed", icon: <FaBan />, cls: danger },
  inactive: { label: "Inactive", icon: <FaBan />, cls: neutral },
  draft: { label: "Draft", icon: <FaHourglassHalf />, cls: neutral },

  info: { label: "Info", icon: <FaInfoCircle />, cls: neutral },
  unknown: { label: "Unknown", icon: <FaInfoCircle />, cls: neutral },
};

const StatusChip = ({ status, className = "" }) => {
  const key = (status || "info").toLowerCase();
  const cfg = configs[key] || configs.info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls} ${className}`}
    >
      <span className="text-[11px] leading-none">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};

export default StatusChip;
