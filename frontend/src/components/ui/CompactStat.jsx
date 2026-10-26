import React from "react";
import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";

/**
 * CompactStat — the phone-sized KPI used in the 2×2 summary strip.
 *
 * The full StatTile (icon orb, hint, sparkline, 38px numeral) is still what
 * renders from `sm` up. This variant keeps only the number and its label so
 * four metrics fit in the first screen instead of four stacked cards.
 */
const toneDot = {
  brand: "bg-[var(--brand)]",
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info)]",
  excused: "bg-[var(--excused)]",
};

const CompactStat = ({ label, value, tone = "brand", to, sublabel }) => {
  const Comp = to ? Link : "div";
  const linkProps = to ? { to } : {};

  return (
    <Comp
      {...linkProps}
      className="flex min-h-[68px] flex-col justify-between gap-2 rounded-xl border border-line bg-card/70 px-3 py-2.5 shadow-[var(--elev-1)] backdrop-blur-sm"
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-on-muted">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone] || toneDot.brand}`}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </span>

      <span className="flex items-end justify-between gap-1">
        <span className="num font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-on">
          {value}
        </span>
        {sublabel ? (
          <span className="pb-0.5 text-[10px] leading-none text-on-muted">{sublabel}</span>
        ) : to ? (
          <FaChevronRight className="mb-0.5 text-[8px] text-on-muted" aria-hidden="true" />
        ) : null}
      </span>
    </Comp>
  );
};

export default CompactStat;
