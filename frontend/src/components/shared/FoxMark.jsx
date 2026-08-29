import React from "react";

// Original stylized geometric fox mark - inspired by (not copied from) the Bit Defenders / CCIT identit
const FoxMark = ({ className = "w-9 h-9" }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="foxGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FF7A45" />
        <stop offset="1" stopColor="#E63946" />
      </linearGradient>
    </defs>
    {/* Face */}
    <path
      d="M24 8 L37 16 L42 30 L33 40 L15 40 L6 30 L11 16 Z"
      fill="url(#foxGrad)"
    />
    {/* Left ear */}
    <path d="M11 16 L6 4 L18 11 Z" fill="#E63946" />
    {/* Right ear */}
    <path d="M37 16 L42 4 L30 11 Z" fill="#E63946" />
    {/* Inner ears */}
    <path d="M12.5 13 L10 7.5 L16.5 11.5 Z" fill="#FFC2A1" />
    <path d="M35.5 13 L38 7.5 L31.5 11.5 Z" fill="#FFC2A1" />
    {/* Muzzle */}
    <path d="M16 34 L24 38 L32 34 L32 42 L16 42 Z" fill="#FFF6F0" />
    {/* Eyes */}
    <circle cx="17.5" cy="25" r="2.6" fill="#2B0A0A" />
    <circle cx="30.5" cy="25" r="2.6" fill="#2B0A0A" />
    {/* Eye highlights */}
    <circle cx="18.3" cy="24.2" r="0.9" fill="#FFF" />
    <circle cx="31.3" cy="24.2" r="0.9" fill="#FFF" />
    {/* Nose */}
    <path d="M22 34 Q24 32.5 26 34 L24 37 Z" fill="#2B0A0A" />
    {/* Cheek highlight */}
    <path d="M12 30 Q14 27 10 27 Z" fill="#FF9" opacity="0.5" />
  </svg>
);

export default FoxMark;
