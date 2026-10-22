import React from "react";
import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import Sparkline from "./Sparkline";

const tones = {
  brand: {
    orb: "bg-gradient-to-br from-[var(--brand-solid)] to-[var(--brand-2)]",
    accent: "linear-gradient(180deg, var(--brand), var(--brand-2) 55%, var(--brand-3))",
    spark: "var(--brand)",
  },
  ok: {
    orb: "bg-gradient-to-br from-[var(--ok)] to-[var(--brand-3)]",
    accent: "linear-gradient(180deg, var(--ok), var(--brand-3))",
    spark: "var(--ok)",
  },
  warn: {
    orb: "bg-gradient-to-br from-[var(--warn)] to-[#f59e0b]",
    accent: "linear-gradient(180deg, var(--warn), #f59e0b)",
    spark: "var(--warn)",
  },
  danger: {
    orb: "bg-gradient-to-br from-[var(--danger)] to-[var(--warn)]",
    accent: "linear-gradient(180deg, var(--danger), var(--warn))",
    spark: "var(--danger)",
  },
  info: {
    orb: "bg-gradient-to-br from-[var(--info)] to-[var(--brand-3)]",
    accent: "linear-gradient(180deg, var(--info), var(--brand-3))",
    spark: "var(--info)",
  },
  excused: {
    orb: "bg-gradient-to-br from-[var(--excused)] to-[var(--brand-3)]",
    accent: "linear-gradient(180deg, var(--excused), var(--brand-3))",
    spark: "var(--excused)",
  },
};

/**
 * StatTile — the dashboard KPI: micro label, display numeral, gradient icon,
 * optional trend sparkline and hint. Optionally a router link.
 */
const StatTile = ({
  label,
  value,
  icon,
  hint,
  delta,
  deltaLabel,
  tone = "brand",
  data,
  to,
  surface = "flight",
  glass = true,
  className = "",
}) => {
  const Comp = to ? Link : "div";
  const linkProps = to ? { to } : {};
  const palette = tones[tone] || tones.brand;

  if (surface === "flight") {
    return (
      <Comp
        {...linkProps}
        style={{ "--fd-accent": palette.spark }}
        className={`fd-surface fd-instrument fd-metric group ${
          glass ? "fd-glass" : ""
        } ${to ? "fd-interactive" : ""} ${className}`}
      >
        <div className="fd-rail fd-rail-compact">
          <p className="fd-eyebrow">{label}</p>
          <div className="flex items-center gap-2.5">
            {icon && <span className="fd-metric-icon text-[12px]">{icon}</span>}
            <span
              className="fd-dot"
              style={{ color: palette.spark }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="fd-body">
          <div className="flex items-start justify-between gap-3">
            <p className="num font-display text-[38px] font-bold leading-none tracking-[-0.03em] text-on">
              {value}
            </p>
            {to && (
              <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-on-muted transition-colors group-hover:text-brand">
                View
                <FaChevronRight
                  className="text-[8px] transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            )}
          </div>

          <div className="mt-2 flex min-h-[18px] flex-wrap items-center gap-2">
            {delta != null && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  deltaLabel === "down"
                    ? "bg-danger/10 text-danger"
                    : "bg-ok/10 text-ok"
                }`}
              >
                {delta}
              </span>
            )}
            {(hint || deltaLabel) && (
              <p className="truncate text-xs text-on-muted">{hint || deltaLabel}</p>
            )}
          </div>

          {Array.isArray(data) && data.length > 1 && (
            <div className="fd-spark">
              <Sparkline
                data={data}
                color={palette.spark}
                className="h-full w-full"
                height={40}
                label={`${label} trend`}
              />
            </div>
          )}
        </div>
      </Comp>
    );
  }

  return (
    <Comp
      {...linkProps}
      style={{ "--panel-accent": palette.accent }}
      className={`panel-surface panel-accent group relative overflow-hidden rounded-[var(--panel-radius)] p-5 ${
        to ? "panel-hover" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-muted">
            {label}
          </p>
          <p className="num mt-3 font-display text-[34px] font-bold leading-none text-on">
            {value}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {icon && (
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-[5px] text-[15px] text-[var(--card-bg)] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.65)] ring-1 ring-inset ring-white/25 ${palette.orb}`}
            >
              {icon}
            </span>
          )}
          {to && (
            <FaChevronRight
              className="text-[9px] text-on-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {delta != null && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                deltaLabel === "down"
                  ? "bg-danger/10 text-danger"
                  : "bg-ok/10 text-ok"
              }`}
            >
              {delta}
            </span>
          )}
          {(hint || deltaLabel) && !delta && (
            <p className="truncate text-xs text-on-muted">{hint}</p>
          )}
          {delta && hint && <p className="mt-1.5 truncate text-xs text-on-muted">{hint}</p>}
        </div>
        {Array.isArray(data) && data.length > 1 && (
          <Sparkline
            data={data}
            color={palette.spark}
            className="w-24 shrink-0 opacity-80"
            height={34}
            label={`${label} trend`}
          />
        )}
      </div>
    </Comp>
  );
};

export default StatTile;
