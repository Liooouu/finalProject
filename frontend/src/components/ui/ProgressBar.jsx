import React from "react";

/**
 * ProgressBar — shows progress toward a target.
 * Renders a "current / target (percent)" label above a full-width track with a
 * brand-gradient fill.
 */
const tones = {
  brand:
    "bg-gradient-to-r from-[var(--brand-solid)] via-[var(--brand-2)] to-[var(--brand-3)]",
  ok: "bg-gradient-to-r from-[var(--ok)] to-[var(--brand-3)]",
  warn: "bg-gradient-to-r from-[var(--warn)] to-[#f59e0b]",
  danger: "bg-gradient-to-r from-[var(--danger)] to-[var(--warn)]",
  info: "bg-gradient-to-r from-[var(--info)] to-[var(--brand-3)]",
};

const ProgressBar = ({
  current,
  target,
  className = "",
  barClassName = "",
  showLabel = true,
  label,
  tone = "brand",
}) => {
  const safeTarget = target || 1;
  const pct = Math.min(100, Math.max(0, (current / safeTarget) * 100));
  const pctRounded = Math.round(pct);

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-on-dim">
            {label || `${current} / ${target} hrs completed`}
          </span>
          <span className="num shrink-0 font-semibold text-on">{pctRounded}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-card-alt ring-1 ring-inset ring-line"
        role="progressbar"
        aria-valuenow={pctRounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tones[tone] || tones.brand
          } ${barClassName}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
