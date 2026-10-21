import React from "react";

// Monochrome so the mark stays crisp on light chips, brand gradients and dark
// photo panels. The parent sets the colour with `text-*`.
const TrackMark = ({ className = "h-9 w-9" }) => (
  <svg
    className={className}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M24 3.5 32 9.5 24 15.5 16 9.5Z" fill="currentColor" />
    <path
      d="M24 15.5V20"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    <path
      d="M24 17.5 21.7 20.5M24 17.5V21M24 17.5 26.3 20.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.55"
    />

    <circle cx="24" cy="32" r="11.5" stroke="currentColor" strokeWidth="3" />
    <path
      d="M24 43.5V47M35.5 32H39.5M12.5 32H8.5"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="24" cy="32" r="2.4" fill="currentColor" />
  </svg>
);

export default TrackMark;
