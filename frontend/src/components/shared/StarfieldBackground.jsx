import React from "react";

const STARS = Array.from({ length: 90 }, (_, i) => {
  const s = 1 + ((i * 7) % 3);
  return {
    id: i,
    left: (i * 37) % 100,
    top: (i * 61) % 100,
    size: s,
    delay: ((i * 13) % 10) / 10,
    dur: 2.4 + ((i * 17) % 50) / 10,
    big: i % 11 === 0,
  };
});

const METEORS = [
  { id: 0, dur: 7, delay: 1.2, top: 6, color: "#ffd9c9" },
  { id: 1, dur: 9, delay: 4.5, top: 16, color: "#ff7a6b" },
  { id: 2, dur: 11, delay: 7.0, top: 26, color: "#ffb4a2" },
  { id: 3, dur: 8, delay: 2.6, top: 40, color: "#ff8f7a" },
];

const StarfieldBackground = ({ isDark, children }) => {
  const starColor = isDark ? "#ffffff" : "#b06060";
  const meteorCol = isDark ? "#ffd9c9" : "#c05a5a";

  return (
    <div className="relative flex min-h-screen overflow-hidden text-on">
      {/* Solid theme base */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={
          isDark
            ? { background: "linear-gradient(180deg, #3a0a18 0%, #2c070d 55%, #1c0509 100%)" }
            : { background: "linear-gradient(180deg, #fff 0%, #fdf3f3 55%, #f7e8e8 100%)" }
        }
      />

      {/* Starfield */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {STARS.map((st) => (
          <span
            key={st.id}
            className="star-dot"
            style={{
              left: `${st.left}%`,
              top: `${st.top}%`,
              width: st.size,
              height: st.size,
              background: st.big ? "#fff6ee" : starColor,
              boxShadow: st.big ? "0 0 6px 1px rgba(255,240,230,0.8)" : "none",
              opacity: isDark ? undefined : 0.25,
              animationDelay: `${st.delay}s`,
              animationDuration: `${st.dur}s`,
            }}
          />
        ))}
      </div>

      {/* Falling meteors */}
      {METEORS.map((m) => (
        <span
          key={m.id}
          className="meteor"
          style={{
            top: `${m.top}%`,
            background: meteorCol,
            color: meteorCol,
            boxShadow: `0 0 10px 0 ${meteorCol}`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.dur}s`,
            opacity: isDark ? undefined : 0.35,
          }}
        />
      ))}

      {/* Concentric arcs motif (faint) */}
      <svg
        aria-hidden="true"
        className="absolute -right-48 -top-48 w-[46rem] h-[46rem] pointer-events-none"
        style={{ opacity: isDark ? 0.1 : 0.05 }}
        viewBox="0 0 600 600"
        fill="none"
      >
        <g stroke={isDark ? "#ffffff" : "#B91C2C"}>
          {[300, 250, 200, 150, 100, 50].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} strokeWidth="1.5" />
          ))}
        </g>
      </svg>

      {/* Fox silhouette accent */}
      <svg
        aria-hidden="true"
        className="absolute bottom-6 right-8 w-40 h-40 pointer-events-none"
        style={{ opacity: isDark ? 0.05 : 0.04 }}
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

export default StarfieldBackground;
