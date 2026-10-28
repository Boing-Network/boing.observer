import type { Metadata } from "next";
import Link from "next/link";

// A child `alternates` object replaces the root layout's canonical, so this page does not claim the home URL.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
  alternates: {},
};

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl py-10 text-center" aria-labelledby="not-found-title">
      <p className="font-mono text-sm text-[var(--text-muted)]">404</p>
      <h1 id="not-found-title" className="mt-2 font-display text-3xl font-bold text-[var(--text-primary)]">
        Page not found
      </h1>
      <p className="mt-3 text-[var(--text-secondary)]">
        That address does not exist on Boing Observer. Search for a block height, transaction id, address or
        .boing name from the search box above, or jump to one of these:
      </p>
      <ul className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        {[
          ["/", "Home"],
          ["/tokens", "Tokens"],
          ["/dex/pools", "DEX directory"],
          ["/qa", "Quality Gate"],
          ["/tools", "Tools"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border-color)] px-4 text-network-cyan hover:border-[var(--border-hover)] hover:text-network-cyan-light"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
