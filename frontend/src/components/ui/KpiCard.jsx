import React from "react";
import { FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";

/**
 * KpiCard — a number, a short label, and a trend indicator.
 * Kept for callers that predate StatTile; shares the same surface language.
 */
const KpiCard = ({ label, value, trend, trendDown, icon, hint, className = "" }) => {
  return (
    <div
      className={`panel-surface panel-accent relative overflow-hidden rounded-[var(--panel-radius)] p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="num text-[34px] font-bold leading-none text-on">
              {value}
            </span>
            {trend != null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  trendDown
                    ? "bg-danger/10 text-danger"
                    : "bg-ok/10 text-ok"
                }`}
              >
                {trendDown ? <FaArrowTrendDown /> : <FaArrowTrendUp />}
                {trend}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-[var(--brand-solid)] to-[var(--brand-2)] text-[15px] text-[var(--card-bg)] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.65)] ring-1 ring-inset ring-white/25">
            {icon}
          </span>
        )}
      </div>
      {hint && <p className="mt-4 truncate text-xs text-on-muted">{hint}</p>}
    </div>
  );
};

export default KpiCard;
