import type { SVGProps } from "react";

type LogoMarkProps = SVGProps<SVGSVGElement>;

/**
 * Observer mark: rounded aperture with a single inner block.
 * Geometric, monochrome-legible, and free of coin, shield, chain, or rocket motifs.
 * Final lockup and mascot art are still a design handoff — this is the working symbol.
 */
export function LogoMark({ className, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <rect
        x="2.25"
        y="2.25"
        width="27.5"
        height="27.5"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="10" y="10" width="12" height="12" rx="3.5" fill="var(--accent)" />
    </svg>
  );
}
