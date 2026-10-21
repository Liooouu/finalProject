import React from "react";

/**
 * BadgeItem — gamification achievement chip: a rounded icon container with a
 * warm glow when earned, dimmed when locked.
 */
const BadgeItem = ({ earned = true, icon, label, className = "" }) => {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        earned
          ? "border-warn/25 bg-warn/10"
          : "border-line bg-card-alt/40 opacity-55"
      } ${className}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
          earned
            ? "bg-warn/15 text-warn ring-1 ring-inset ring-warn/30"
            : "bg-card-alt text-on-muted grayscale"
        }`}
      >
        {icon}
      </div>
      <span className={`truncate text-[13px] font-medium ${earned ? "text-on" : "text-on-muted"}`}>
        {label}
      </span>
    </div>
  );
};

export default BadgeItem;
