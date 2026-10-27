import { BRAND } from "@/lib/brand";

/** Honest network status. Public chain activity on this explorer is testnet. */
export function TestnetStatus({ className = "" }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-boing-navy-mid/70 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] ${className}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
      {BRAND.testnetStatus}
    </p>
  );
}
