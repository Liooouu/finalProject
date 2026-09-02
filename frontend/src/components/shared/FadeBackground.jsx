import React from "react";
import techDark from "../../assets/images/tech-bg-dark.jpg";
import techLight from "../../assets/images/tech-bg-light.jpg";

const FadeBackground = ({ isDark, children }) => {
  return (
    <div className="relative flex min-h-screen overflow-hidden text-on">
      {/* Solid theme base (ensures readable fallback) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={
          isDark
            ? { background: "linear-gradient(180deg, #5c1019 0%, #3a0a12 55%, #2c070d 100%)" }
            : { background: "linear-gradient(180deg, #fff 0%, #fbf0f0 60%, #f6e8e8 100%)" }
        }
      />

      {/* Fading tech image (fades to transparent toward the bottom) */}
      <img
        src={isDark ? techDark : techLight}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top pointer-events-none"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 45%, rgba(0,0,0,0.6) 70%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 45%, rgba(0,0,0,0.6) 70%, transparent 100%)",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      />

      {/* Light-red tint overlay (recolors the real photo, keeps shapes/brightness) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          mixBlendMode: "color",
          background: isDark
            ? "#c94a52" // soft crimson-night
            : "#e58f94", // light rose
          opacity: isDark ? 0.75 : 0.6,
        }}
      />

      {/* Subtle bottom fade to solidify the transition */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={
          isDark
            ? { background: "linear-gradient(to bottom, transparent 60%, rgba(44,7,13,0.9) 100%)" }
            : { background: "linear-gradient(to bottom, transparent 60%, rgba(246,232,232,0.95) 100%)" }
        }
      />

      {/* Concentric arcs motif (kept faint on top) */}
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

      {/* TrackMark silhouette accent (scope + graduation tassel) */}
      <svg
        aria-hidden="true"
        className="absolute bottom-6 right-8 w-40 h-40 pointer-events-none"
        style={{ opacity: 0.05 }}
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

      {children}
    </div>
  );
};

export default FadeBackground;
