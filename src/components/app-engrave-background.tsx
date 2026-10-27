"use client";

import { useId } from "react";

/**
 * Deep-navy canvas with a technical grid and one static accent glow.
 * The vein drawing stays faint so the surface reads as an instrument, not a poster.
 */
export function AppEngraveBackground() {
  const uid = useId().replace(/:/g, "");
  const lineGradId = `${uid}-engrave-line`;
  const softFilterId = `${uid}-engrave-soft`;

  return (
    <div className="app-engrave-bg" aria-hidden>
      <div className="app-engrave-stone" />
      <div className="app-engrave-grid" />
      <div className="app-engrave-grain" />
      <svg
        className="app-engrave-vein"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 280"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={lineGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a9aaf" stopOpacity="0.14" />
            <stop offset="35%" stopColor="#c5d0e0" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#6a7688" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#9aa8bc" stopOpacity="0.16" />
          </linearGradient>
          <filter id={softFilterId} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className="app-engrave-vein__shadow"
          fill="none"
          stroke="rgba(0, 0, 0, 0.45)"
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 8 0 C 22 38 42 18 52 52 C 62 86 28 98 68 128 C 92 148 36 168 88 188 C 98 208 48 222 78 242 C 88 258 32 268 12 280"
        />
        <path
          className="app-engrave-vein__line"
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${softFilterId})`}
          d="M 8 0 C 22 38 42 18 52 52 C 62 86 28 98 68 128 C 92 148 36 168 88 188 C 98 208 48 222 78 242 C 88 258 32 268 12 280"
        />
        <g className="app-engrave-nodes" fill="none" strokeLinecap="round">
          <circle cx="8" cy="0" r="2.2" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
          <circle
            cx="8"
            cy="0"
            r="2.2"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.25"
            transform="translate(-0.12 -0.12)"
          />
          <circle cx="52" cy="52" r="1.8" stroke="rgba(0,0,0,0.45)" strokeWidth="0.45" />
          <circle
            cx="52"
            cy="52"
            r="1.8"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.2"
            transform="translate(-0.1 -0.1)"
          />
          <circle cx="68" cy="128" r="2" stroke="rgba(0,0,0,0.48)" strokeWidth="0.48" />
          <circle
            cx="68"
            cy="128"
            r="2"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.22"
            transform="translate(-0.1 -0.1)"
          />
          <circle cx="88" cy="188" r="1.6" stroke="rgba(0,0,0,0.42)" strokeWidth="0.42" />
          <circle
            cx="88"
            cy="188"
            r="1.6"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.18"
            transform="translate(-0.08 -0.08)"
          />
          <circle cx="78" cy="242" r="1.7" stroke="rgba(0,0,0,0.44)" strokeWidth="0.44" />
          <circle
            cx="78"
            cy="242"
            r="1.7"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.2"
            transform="translate(-0.09 -0.09)"
          />
          <circle cx="12" cy="280" r="2.1" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
          <circle
            cx="12"
            cy="280"
            r="2.1"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.24"
            transform="translate(-0.11 -0.11)"
          />
        </g>
        <path
          className="app-engrave-vein__shadow app-engrave-vein__branch"
          fill="none"
          stroke="rgba(0, 0, 0, 0.35)"
          strokeWidth="0.65"
          strokeLinecap="round"
          d="M 52 52 C 72 58 82 72 94 68 M 68 128 C 58 142 52 162 44 178 M 88 188 C 72 198 58 212 48 228"
        />
        <path
          className="app-engrave-vein__line app-engrave-vein__branch"
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="0.35"
          strokeLinecap="round"
          opacity="0.85"
          d="M 52 52 C 72 58 82 72 94 68 M 68 128 C 58 142 52 162 44 178 M 88 188 C 72 198 58 212 48 228"
        />
        <circle cx="94" cy="68" r="1.35" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
        <circle
          cx="94"
          cy="68"
          r="1.35"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.16"
          transform="translate(-0.06 -0.06)"
        />
        <circle cx="44" cy="178" r="1.25" fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth="0.38" />
        <circle
          cx="44"
          cy="178"
          r="1.25"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.15"
          transform="translate(-0.06 -0.06)"
        />
        <circle cx="48" cy="228" r="1.2" fill="none" stroke="rgba(0,0,0,0.36)" strokeWidth="0.36" />
        <circle
          cx="48"
          cy="228"
          r="1.2"
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="0.14"
          transform="translate(-0.05 -0.05)"
        />
      </svg>
      <div className="app-neon-layer">
        <span className="app-neon app-neon--orb app-neon--a" />
        <span className="app-neon app-neon--orb app-neon--b" />
        <span className="app-neon app-neon--orb app-neon--c" />
        <span className="app-neon app-neon--arc app-neon--d" />
        <span className="app-neon app-neon--arc app-neon--e" />
        <span className="app-neon app-neon--dash app-neon--f" />
        <span className="app-neon app-neon--dash app-neon--g" />
        <span className="app-neon app-neon--dot app-neon--h" />
        <span className="app-neon app-neon--dot app-neon--i" />
      </div>
    </div>
  );
}
