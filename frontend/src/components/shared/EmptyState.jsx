import React from "react";
import TrackMark from "./TrackMark";

const EmptyState = ({ icon, title, description, action, compact = false, className = "" }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "px-4 py-8" : "px-6 py-14"
      } ${className}`}
    >
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card-alt/70 text-xl text-on-muted">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--brand)]/10 via-transparent to-transparent"
        />
        <span className="relative">{icon ? icon : <TrackMark className="h-7 w-7" />}</span>
      </div>
      {title && (
        <p className="font-display text-[15px] font-semibold text-on">{title}</p>
      )}
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-on-dim">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
