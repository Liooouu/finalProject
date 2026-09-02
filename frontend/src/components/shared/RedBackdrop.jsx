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

      {/* TrackMark silhouette accent (scope + graduation tassel) */}
      <svg
        aria-hidden="true"
        className="absolute bottom-6 right-8 w-40 h-40 pointer-events-none"
        style={{ opacity: isDark ? 0.05 : 0.05 }}
        viewBox="0 0 48 48"
        fill="none"
        stroke={isDark ? "#ffffff" : "#B91C2C"}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M24 4.5 L29 10 L24 15.5 L19 10 Z" fill={isDark ? "#ffffff" : "#B91C2C"} stroke="none" />
        <path d="M24 15.5 L24 20" />
        <circle cx="24" cy="15.5" r="1.3" fill={isDark ? "#ffffff" : "#B91C2C"} stroke="none" />
        <path d="M24 17 L22.2 19.4 M24 17 L24 19.8 M24 17 L25.8 19.4" />
        <circle cx="24" cy="31" r="11" />
        <path d="M24 42 L24 46.5 M35 31 L39.5 31 M13 31 L8.5 31" />
        <circle cx="24" cy="31" r="2.2" fill={isDark ? "#ffffff" : "#B91C2C"} stroke="none" />
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
