import type { SVGProps } from "react";

const TEAL = "#00e8c8";

type LogoMarkProps = SVGProps<SVGSVGElement>;

/**
 * Boing Observer mark: hex “block” frame + stacked lines + focal dot (Express teal).
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
      <path d="M16 9.5 22.5 13.25v5.5L16 22.5 9.5 18.75v-5.5L16 9.5z" fill={TEAL} fillOpacity={0.08} />
      <path
        d="M16 9.5 22.5 13.25v5.5L16 22.5 9.5 18.75v-5.5L16 9.5z"
        stroke={TEAL}
        strokeWidth={1.65}
        strokeLinejoin="round"
      />
      <path
        d="M11.5 14h6.5M11.5 17h9.5M11.5 20h4.5"
        stroke={TEAL}
        strokeWidth={1.35}
        strokeLinecap="round"
        opacity={0.95}
      />
      <circle cx={16} cy={16.75} r={1.15} fill={TEAL} />
    </svg>
  );
}
