import React from "react";

const Loading = ({ label = "Loading...", className = "" }) => {
  return (
    <div className={`flex h-40 items-center justify-center ${className}`} role="status">
      <div className="flex items-center gap-2.5 text-on-dim">
        <span className="skeleton h-4 w-4 rounded-full" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
};

export default Loading;