import React from "react";
import TrackMark from "./TrackMark";

// Stack logo + wordmark. The mark is always centred over the wordmark.
const BrandMark = ({ onLight = false, className = "" }) => (
  <div className={`flex flex-col items-center gap-2.5 text-center ${className}`}>
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${
        onLight
          ? "bg-white text-brand ring-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
          : "bg-brand/10 text-brand ring-brand/20"
      }`}
    >
      <TrackMark className="h-10 w-10" />
    </span>
    <p
      className={`font-display text-2xl font-bold tracking-tight ${
        onLight ? "text-white" : "text-on"
      }`}
    >
      Track<span className={onLight ? "text-white/65" : "text-brand"}>ED</span>
    </p>
  </div>
);

export default BrandMark;
