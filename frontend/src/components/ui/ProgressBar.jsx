import React from "react";

/**
 * ProgressBar — shows progress toward a target using a plain Tailwind div.
 * Renders a "current / target (percent)" label above a full-width bar with a
 * dynamic-width inner fill in the accent color.
 */
const ProgressBar = ({
  current,
  target,
  className = "",
  barClassName = "",
  showLabel = true,
  label,
}) => {
  const safeTarget = target || 1;
  const pct = Math.min(100, Math.max(0, (current / safeTarget) * 100));
  const pctRounded = Math.round(pct);

  return (
    <div className={`${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-on-dim">
            {label || `${current} / ${target} hrs completed`}
          </span>
          <span className="text-on font-semibold">{pctRounded}%</span>
        </div>
      )}
      <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full bg-red-500 rounded-full transition-all duration-500 ${barClassName}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
