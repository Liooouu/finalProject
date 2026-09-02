import React from "react";

/**
 * TableSkeleton — shimmer skeleton for data tables while data loads.
 * Replaces spinner-based loading for anything with layout.
 */
const TableSkeleton = ({ rows = 6, cols = 4, className = "" }) => {
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="grid gap-4 border-b border-line bg-card-alt px-4 py-3.5" style={grid}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton h-3 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 border-b border-line px-4 py-4" style={grid}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={`skeleton h-3.5 rounded ${c === 0 ? "w-3/4" : "w-full"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableSkeleton;