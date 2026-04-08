import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

type SiteLogoProps = {
  /** Larger mark + type for the home hero. */
  variant?: "header" | "hero";
  className?: string;
  /** When set, render as page heading (no link) — use on the home hero only. */
  headingId?: string;
};

/**
 * Wordmark + mark; matches Comfortaa + Express / engraved theme.
 */
export function SiteLogo({ variant = "header", className = "", headingId }: SiteLogoProps) {
  const isHero = variant === "hero";
  const markClass = isHero ? "h-10 w-10 shrink-0 sm:h-12 sm:w-12" : "h-8 w-8 shrink-0 sm:h-9 sm:w-9";
  const textClass = isHero
    ? "font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl"
    : "font-display text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg";

  const shellClass = `group inline-flex min-w-0 items-center gap-2 rounded-md outline-none transition-[filter,colors] ${headingId ? "" : "hover:text-network-cyan focus-visible:ring-2 focus-visible:ring-network-cyan/50"} ${className}`;

  const inner = (
    <>
      <LogoMark
        className={`${markClass} transition-[filter] ${headingId ? "" : "group-hover:drop-shadow-[0_0_12px_rgba(0,232,200,0.35)]"}`}
      />
      <span className={`min-w-0 ${textClass}`}>
        <span className="hidden min-[360px]:inline">Boing </span>
        Observer
      </span>
    </>
  );

  if (headingId != null) {
    return (
      <h1 id={headingId} className={shellClass}>
        {inner}
      </h1>
    );
  }

  return (
    <Link href="/" className={shellClass} aria-label="Boing Observer - Home">
      {inner}
    </Link>
  );
}
