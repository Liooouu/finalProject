import React from "react";
import TrackMark from "./TrackMark";

const EmptyState = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-alt text-2xl text-on-muted">
        {icon ? icon : <TrackMark className="h-8 w-8" />}
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--app-base)] bg-indigo-500" />
      </div>
      {title && <p className="font-semibold text-on">{title}</p>}
      {description && (
        <p className="mt-1 max-w-sm text-sm text-on-dim">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;