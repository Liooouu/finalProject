import React from "react";
import TrackMark from "./TrackMark";

// Stack logo + wordmark. `onLight` switches to the glass treatment used over
// the dark photo panel.
const BrandMark = ({ onLight = false, className = "" }) => (
  <div
    className={`flex flex-col items-center gap-2 lg:items-start ${className}`}
  >
    <span
      className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${
        onLight ? "bg-white/10 ring-white/20" : "bg-indigo-500/10 ring-indigo-500/20"
      }`}
    >
      <TrackMark className="h-9 w-9" />
    </span>
    <p className={`text-xl font-bold tracking-tight ${onLight ? "text-white" : "text-on"}`}>
      Track<span className="text-indigo-400">ED</span>
    </p>
  </div>
);

export default BrandMark;
