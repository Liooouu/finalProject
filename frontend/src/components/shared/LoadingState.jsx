import React from "react";

const LoadingState = ({ rows = 4, className = "" }) => {
  return (
    <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-line rounded-xl p-5 animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-black/10 dark:bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-black/5 dark:bg-white/5" />
            </div>
            <div className="w-20 h-6 rounded-full bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingState;
