import React from "react";

/**
 * BadgeItem — gamification achievement chip: a circular icon container with a
 * subtle glow/border when earned, grayscale/dimmed when locked.
 *
 * TODO(badges): Badge eligibility is currently computed on the frontend from
 * existing stats. If badges should be server-authoritative, add an Express
 * route (e.g. GET /student/achievements) that evaluates these rules against
 * the student's attendance/service records instead.
 */
const BadgeItem = ({ earned = true, icon, label, className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${earned ? "" : "opacity-40"} ${className}`}>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
          earned
            ? "bg-yellow-500/15 text-yellow-400 ring-2 ring-yellow-400/70 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
            : "bg-gray-600/20 text-gray-500 grayscale ring-2 ring-gray-600/50"
        }`}
      >
        {icon}
      </div>
      <span className={`text-sm ${earned ? "text-on" : "text-on-muted"}`}>{label}</span>
    </div>
  );
};

export default BadgeItem;
