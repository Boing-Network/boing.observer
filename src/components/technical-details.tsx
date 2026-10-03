import type { ReactNode } from "react";

/**
 * Collapsed technical notes for explorer pages.
 * Keep primary page copy semantic; put RPC/method/operator detail here or on /about, /qa/rules, /tools.
 */
export function TechnicalDetails({
  summary = "Technical details",
  children,
  className = "",
}: {
  summary?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 px-4 py-3 text-sm text-[var(--text-secondary)] ${className}`}
    >
      <summary className="cursor-pointer font-medium text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-network-cyan/50">
        {summary}
      </summary>
      <div className="mt-3 space-y-2 leading-relaxed text-[var(--text-muted)]">{children}</div>
    </details>
  );
}
