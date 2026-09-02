import React from "react";
import {
  FaCheck,
  FaClock,
  FaTimes,
  FaArchive,
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
 * Covers attendance, excuse, and event lifecycle statuses.
 */
const configs = {
  present: { label: "Present", icon: <FaCheck />, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25" },
  attended: { label: "Attended", icon: <FaCheck />, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25" },
  approved: { label: "Approved", icon: <FaCheckCircle />, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25" },

  late: { label: "Late", icon: <FaClock />, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25" },
  pending: { label: "Pending", icon: <FaHourglassHalf />, cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/25" },

  absent: { label: "Absent", icon: <FaTimes />, cls: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/25" },
  rejected: { label: "Rejected", icon: <FaTimesCircle />, cls: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/25" },

  excused: { label: "Excused", icon: <FaFileMedical />, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/25" },

  upcoming: { label: "Upcoming", icon: <FaCalendarAlt />, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/25" },
  live: { label: "Live", icon: <FaDotCircle />, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25" },
  closed: { label: "Closed", icon: <FaArchive />, cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/25" },

  info: { label: "Info", icon: <FaInfoCircle />, cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/25" },
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