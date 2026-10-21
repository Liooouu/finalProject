import React, { useId } from "react";

const palettes = {
  brand: ["var(--brand)", "var(--brand-2)"],
  ok: ["var(--ok)", "var(--brand-3)"],
  warn: ["var(--warn)", "#f97316"],
  danger: ["var(--danger)", "var(--warn)"],
  info: ["var(--info)", "var(--brand-3)"],
};

/**
 * ProgressRing — SVG progress with a gradient stroke and centered label.
 */
const ProgressRing = ({
  value = 0,
  max = 100,
  size = 128,
  stroke = 10,
  label,
  sublabel,
  tone = "brand",
  className = "",
}) => {
  const rawId = useId();
  const id = `ring-${rawId.replace(/[:]/g, "")}`;
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [from, to] = palettes[tone] || palettes.brand;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? `${Math.round(ratio * 100)} percent`}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line-color)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="num font-display text-xl font-bold leading-none text-on">
          {label ?? `${Math.round(ratio * 100)}%`}
        </span>
        {sublabel && <span className="mt-1 text-[10px] text-on-muted">{sublabel}</span>}
      </div>
    </div>
  );
};

export default ProgressRing;
