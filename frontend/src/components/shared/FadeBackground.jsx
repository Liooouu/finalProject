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

      {/* Fox silhouette accent (Bit Defenders-inspired) */}
      <svg
        aria-hidden="true"
        className="absolute bottom-6 right-8 w-40 h-40 pointer-events-none"
        style={{ opacity: 0.05 }}
        viewBox="0 0 48 48"
        fill={isDark ? "#ffffff" : "#B91C2C"}
      >
        <path d="M24 6 L38 15 L43 30 L33 41 L15 41 L5 30 L10 15 Z" />
        <path d="M10 15 L5 3 L19 11 Z" />
        <path d="M38 15 L43 3 L29 11 Z" />
      </svg>

      {children}
    </div>
  );
};

export default FadeBackground;
