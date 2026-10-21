import React, { useId } from "react";

const buildPaths = (values, width = 100, height = 100, pad = 3) => {
  if (!Array.isArray(values) || values.length === 0) {
    return { line: "", area: "" };
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const points = values.map((value, i) => {
    const x = pad + i * step;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y];
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L${last[0].toFixed(2)},${height} L${first[0].toFixed(2)},${height} Z`;

  return { line, area };
};

/**
 * Sparkline — tiny inline SVG trend with no chart.js overhead.
 */
const Sparkline = ({
  data = [],
  color = "var(--brand)",
  height = 40,
  filled = true,
  className = "",
  label = "Trend",
}) => {
  const rawId = useId();
  const id = `spark-${rawId.replace(/[:]/g, "")}`;
  const { line, area } = buildPaths(data);

  if (!line) return <div className={className} style={{ height }} aria-hidden="true" />;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {filled && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={area} fill={`url(#${id})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default Sparkline;
