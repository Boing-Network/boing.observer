import { useId, type SVGProps } from "react";

type LogoMarkProps = SVGProps<SVGSVGElement>;

/**
 * Boing Observer mark: the Boing "Arc Slab" family (rounded slab, recovery arc, glowing orb) in its
 * Observer variant: a flatter scan arc ending in an orb with a pupil and a segmented aperture ring,
 * so it reads as "observing". Each product has its own variant (see BRAND.md).
 * Source of truth for rasters: public/brand/boing-observer-mark.svg (keep geometry in sync).
 */
export function LogoMark({ className, ...props }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const frame = `bo-frame-${uid}`;
  const orb = `bo-orb-${uid}`;
  const slab = `bo-slab-${uid}`;
  const glow = `bo-glow-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id={frame} x1="8" y1="54" x2="56" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B8CFF" />
          <stop offset="0.5" stopColor="#5ab0ff" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={orb} x1="40" y1="14" x2="56" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFE0FF" />
          <stop offset="0.5" stopColor="#3B8CFF" />
          <stop offset="1" stopColor="#8DB8FF" />
        </linearGradient>
        <radialGradient id={slab} cx="34%" cy="28%" r="78%">
          <stop offset="0" stopColor="#18244A" />
          <stop offset="1" stopColor="#0A1128" />
        </radialGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="14" fill={`url(#${slab})`} stroke={`url(#${frame})`} strokeWidth="2.25" />
      <path
        d="M12 47 C 20 47 25 44 29 39 C 33 34 37 30 43 27"
        stroke={`url(#${frame})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle
        cx="45"
        cy="25"
        r="11"
        stroke={`url(#${frame})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="9.6 1.9"
        opacity="0.8"
      />
      <circle cx="45" cy="25" r="6.4" fill={`url(#${orb})`} filter={`url(#${glow})`} />
      <circle cx="45" cy="25" r="2.6" fill="#0A1128" opacity="0.88" />
      <circle cx="43.6" cy="23.6" r="1.1" fill="#F0F4F8" opacity="0.6" />
    </svg>
  );
}
