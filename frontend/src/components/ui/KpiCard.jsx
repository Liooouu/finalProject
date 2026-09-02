import React from "react";
import { FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";

/**
 * KpiCard — a number, a short label, and a trend indicator.
 * No verbose captions (per the design system).
 */
const KpiCard = ({ label, value, trend, trendDown, icon, hint, className = "" }) => {
  return (
    <div className={`rounded-xl border border-line bg-card p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-on-dim">{label}</p>
        {icon && <span className="text-lg text-on-muted">{icon}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[26px] font-bold tracking-tight text-on leading-none">
          {value}
        </span>
        {trend != null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              trendDown ? "text-red-500" : "text-emerald-500"
            }`}
          >
            {trendDown ? <FaArrowTrendDown /> : <FaArrowTrendUp />}
            {trend}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-on-muted">{hint}</p>}
    </div>
  );
};

export default KpiCard;