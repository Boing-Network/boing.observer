/** Shared "Boing apps" switcher (same links on boing.network, boing.express, boing.finance, boing.observer). */
export const BOING_APPS = [
  { name: "Boing Network", desc: "Home, docs, faucet", href: "https://boing.network" },
  { name: "Boing Express", desc: "Wallet", href: "https://boing.express" },
  { name: "Boing Observer", desc: "Block explorer", href: "https://boing.observer" },
  { name: "boing.finance", desc: "Swap, pools, deploy tokens", href: "https://boing.finance" },
] as const;

export function BoingAppsMenu() {
  return (
    <details className="relative">
      <summary
        aria-label="Boing apps"
        className="cursor-pointer list-none rounded-full border border-[var(--border-color)] px-3 py-1 text-sm text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden"
      >
        Apps
      </summary>
      <ul className="absolute right-0 z-[60] mt-2 min-w-[240px] rounded-xl border border-[var(--border-color)] bg-boing-navy-mid p-1.5 shadow-xl">
        {BOING_APPS.map((a) => (
          <li key={a.href}>
            <a href={a.href} rel="noopener" className="flex flex-col rounded-lg px-3 py-2 text-[var(--text-primary)] hover:bg-network-cyan/10">
              <strong className="text-sm">{a.name}</strong>
              <span className="text-xs text-[var(--text-muted)]">{a.desc}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}