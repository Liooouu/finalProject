import React from "react";

const palettes = {
  present: "dark:bg-green-900/50 bg-green-100 dark:text-green-400 text-green-700 dark:border-green-700 border-green-300",
  absent: "dark:bg-red-900/50 bg-red-100 dark:text-red-400 text-red-700 dark:border-red-700 border-red-300",
  late: "dark:bg-yellow-900/50 bg-yellow-100 dark:text-yellow-400 text-yellow-700 dark:border-yellow-700 border-yellow-300",
  pending: "dark:bg-gray-700/50 bg-gray-100 dark:text-gray-300 text-gray-600 dark:border-gray-600 border-gray-300",
  excused: "dark:bg-blue-900/50 bg-blue-100 dark:text-blue-400 text-blue-700 dark:border-blue-700 border-blue-300",
  approved: "dark:bg-green-900/50 bg-green-100 dark:text-green-400 text-green-700 dark:border-green-700 border-green-300",
  rejected: "dark:bg-red-900/50 bg-red-100 dark:text-red-400 text-red-700 dark:border-red-700 border-red-300",
  upcoming: "dark:bg-blue-900/50 bg-blue-100 dark:text-blue-400 text-blue-700 dark:border-blue-700 border-blue-300",
  live: "dark:bg-green-900/50 bg-green-100 dark:text-green-400 text-green-700 dark:border-green-700 border-green-300",
  closed: "dark:bg-gray-700/50 bg-gray-100 dark:text-gray-300 text-gray-600 dark:border-gray-600 border-gray-300",
  info: "dark:bg-purple-900/50 bg-purple-100 dark:text-purple-400 text-purple-700 dark:border-purple-700 border-purple-300",
};

const aliases = {
  present: "present",
  late: "late",
  absent: "absent",
  excused: "excused",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  upcoming: "upcoming",
  live: "live",
  closed: "closed",
};

const StatusBadge = ({ status, className = "" }) => {
  const key = aliases[status] || "info";
  const palette = palettes[key] || palettes.info;
  const label = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Unknown";

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium border ${palette} ${className}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
