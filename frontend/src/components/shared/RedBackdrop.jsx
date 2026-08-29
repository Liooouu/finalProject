import React from "react";

const RedBackdrop = ({ isDark }) => {
  return (
    <>
      {/* Base gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={
          isDark
            ? { background: "linear-gradient(135deg, #7a1422 0%, #4a0d18 45%, #2c070d 100%)" }
            : { background: "linear-gradient(135deg, #FAF5F5 0%, #F7F1F2 45%, #F3ECEC 100%)" }
        }
      />

      {/* Concentric arcs */}
      <svg
        aria-hidden="true"
        className="absolute -right-48 -top-48 w-[46rem] h-[46rem] pointer-events-none"
        style={{ opacity: isDark ? 0.12 : 0.07 }}
        viewBox="0 0 600 600"
        fill="none"
      >
        <g stroke={isDark ? "#ffffff" : "#B91C2C"}>
          {[300, 250, 200, 150, 100, 50].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} strokeWidth="1.5" />
          ))}
          <path d="M300 0 L300 100" strokeWidth="1.5" />
          <path d="M300 500 L300 600" strokeWidth="1.5" />
          <path d="M0 300 L100 300" strokeWidth="1.5" />
          <path d="M500 300 L600 300" strokeWidth="1.5" />
        </g>
      </svg>
      <svg
        aria-hidden="true"
        className="absolute -left-40 bottom-40 w-[32rem] h-[32rem] pointer-events-none"
        style={{ opacity: isDark ? 0.1 : 0.06 }}
        viewBox="0 0 400 400"
        fill="none"
      >
        <g stroke={isDark ? "#ffffff" : "#B91C2C"}>
          {[170, 130, 90, 50].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} strokeWidth="1" />
          ))}
        </g>
      </svg>

      {/* Fox silhouette accent (Bit Defenders-inspired) */}
      <svg
        aria-hidden="true"
        className="absolute bottom-6 right-8 w-40 h-40 pointer-events-none"
        style={{ opacity: isDark ? 0.05 : 0.05 }}
        viewBox="0 0 48 48"
        fill={isDark ? "#ffffff" : "#B91C2C"}
      >
        <path d="M24 6 L38 15 L43 30 L33 41 L15 41 L5 30 L10 15 Z" />
        <path d="M10 15 L5 3 L19 11 Z" />
        <path d="M38 15 L43 3 L29 11 Z" />
      </svg>
      <span
        aria-hidden="true"
        className="absolute top-10 right-14 flex gap-2.5 pointer-events-none"
        style={{ opacity: isDark ? 0.16 : 0.1 }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="text-lg leading-none" style={{ color: isDark ? "#fff" : "#B91C2C" }}>
            ▴
          </span>
        ))}
      </span>

      {/* Ambient glows */}
      <div
        aria-hidden="true"
        className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full pointer-events-none"
        style={
          isDark
            ? { background: "radial-gradient(circle, rgba(230,57,70,0.5) 0%, rgba(230,57,70,0) 70%)" }
            : { background: "radial-gradient(circle, rgba(230,57,70,0.12) 0%, rgba(230,57,70,0) 70%)" }
        }
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-24 w-[36rem] h-[36rem] rounded-full pointer-events-none"
        style={
          isDark
            ? { background: "radial-gradient(circle, rgba(139,30,47,0.45) 0%, rgba(139,30,47,0) 70%)" }
            : { background: "radial-gradient(circle, rgba(185,28,44,0.1) 0%, rgba(185,28,44,0) 70%)" }
        }
      />
    </>
  );
};

export default RedBackdrop;
