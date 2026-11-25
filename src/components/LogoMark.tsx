import React from 'react';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="ednaLensGrad" x1="6" y1="6" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#063B2B" />
          <stop offset="55%" stopColor="#087A50" />
          <stop offset="100%" stopColor="#55D6C2" />
        </linearGradient>
        <linearGradient id="ednaHelixGrad" x1="14" y1="11" x2="28" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9BE564" />
          <stop offset="100%" stopColor="#55D6C2" />
        </linearGradient>
      </defs>
      {/* Magnifying glass ring */}
      <circle cx="21" cy="21" r="15" stroke="url(#ednaLensGrad)" strokeWidth="3.2" fill="#063B2B" fillOpacity="0.06" />
      {/* Magnifying glass handle */}
      <path d="M32 32L42 42" stroke="url(#ednaLensGrad)" strokeWidth="4" strokeLinecap="round" />
      {/* DNA double helix inside lens */}
      <path
        d="M15.5 13C15.5 17 26.5 19 26.5 23C26.5 27 15.5 29 15.5 29"
        stroke="url(#ednaHelixGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M26.5 13C26.5 17 15.5 19 15.5 23C15.5 27 26.5 29 26.5 29"
        stroke="#087A50"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Base pair rungs */}
      <line x1="17.5" y1="16" x2="24.5" y2="16" stroke="#55D6C2" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="21" x2="24" y2="21" stroke="#9BE564" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.5" y1="26" x2="24.5" y2="26" stroke="#55D6C2" strokeWidth="1.5" strokeLinecap="round" />
      {/* Subtle biodiversity leaf motif at upper right rim */}
      <path
        d="M33.5 9.5C36.8 9.2 39 11.4 38.6 14.7C35.3 15 33.1 12.8 33.5 9.5Z"
        fill="#087A50"
      />
      <path d="M33.5 14.5L36.2 11.8" stroke="#9BE564" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
