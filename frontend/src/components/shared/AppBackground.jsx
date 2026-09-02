import React from "react";

/**
 * AppBackground — the app's signature backdrop.
 * A fixed "aurora canvas": softly drifting indigo/cyan/violet glows over a
 * clean neutral base, a faint top grid, and subtle film grain for texture.
 * Theme-aware via CSS variables (the `.dark` variant flips the orbs).
 */
const AppBackground = ({ children }) => {
  return (
    <div className="relative flex min-h-screen overflow-hidden text-on">
      {/* Aurora canvas */}
      <div
        aria-hidden="true"
        className="app-aurora fixed inset-0 z-0 overflow-hidden pointer-events-none"
      >
        <div className="app-orb app-orb-1 -top-56 -left-56 h-[46rem] w-[46rem]" />
        <div className="app-orb app-orb-2 -top-24 -right-56 h-[42rem] w-[42rem]" />
        <div className="app-orb app-orb-3 top-1/3 -left-44 h-[40rem] w-[40rem]" />
        <div className="app-grid absolute inset-0" />
        <div className="app-noise absolute inset-0" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full">{children}</div>
    </div>
  );
};

export default AppBackground;