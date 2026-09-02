import React from "react";

// TrackMark — "scoped" brand mark: a targeting crosshair/reticle lock-on with a
// graduation tassel hanging from the top tick (TrackED : tracking + academics).
const TrackMark = ({ className = "w-9 h-9" }) => (
  <svg
    className={className}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#818cf8" />
        <stop offset="1" stopColor="#4f46e5" />
      </linearGradient>
    </defs>

    {/* Graduation cap (mortarboard) */}
    <path d="M24 4.5 L29 10 L24 15.5 L19 10 Z" fill="url(#trackGrad)" />
    <path d="M19.8 12.6 L28.2 12.6" stroke="#eef2ff" strokeWidth="1.8" strokeLinecap="round" />

    {/* Tassel: cord (north tick) + knot + fringe */}
    <path d="M24 15.5 L24 20" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="24" cy="15.5" r="1.3" fill="#4f46e5" />
    <path
      d="M24 17 L22.2 19.4 M24 17 L24 19.8 M24 17 L25.8 19.4"
      stroke="#a5b4fc"
      strokeWidth="1.8"
      strokeLinecap="round"
    />

    {/* Reticle (scope / crosshair cursor) */}
    <circle cx="24" cy="31" r="11" stroke="url(#trackGrad)" strokeWidth="2.6" />
    <path
      d="M24 42 L24 46.5 M35 31 L39.5 31 M13 31 L8.5 31"
      stroke="#6366f1"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <circle cx="24" cy="31" r="2.2" fill="#1e1b4b" />
    <circle cx="24.7" cy="30.3" r="0.8" fill="#FFFFFF" />
  </svg>
);

export default TrackMark;