"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NETWORK_FAUCET_URL, WALLET_URL } from "@/lib/constants";
import { SearchBar } from "@/components/search-bar";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/qa", label: "QA transparency" },
  { href: "/tools", label: "Tools" },
  { href: "/dex/pools", label: "DEX directory" },
  { href: "/dex/quote", label: "DEX quotes" },
  { href: "/tools/node-health", label: "Node health" },
] as const;

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open && wasOpenRef.current) {
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open]);

  const onEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onEscape]);

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/90 text-[var(--text-primary)] hover:border-[var(--border-hover)] focus:outline-none focus:ring-2 focus:ring-network-cyan lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation and search"
            className="absolute inset-y-0 right-0 flex w-[min(100vw,22rem)] max-w-full flex-col border-l border-[var(--border-color)] bg-[var(--boing-navy-deep)] shadow-2xl"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
              <span className="font-display text-sm font-semibold tracking-wide text-[var(--text-primary)]">
                Menu
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg text-sm font-medium text-network-cyan hover:text-network-cyan-light focus:outline-none focus:ring-2 focus:ring-network-cyan"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
              <div className="space-y-6">
                <div role="search">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Search
                  </p>
                  <SearchBar layout="stacked" />
                </div>

                <nav aria-label="Primary pages" className="flex flex-col border-t border-[var(--border-color)] pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Explore
                  </p>
                  <ul className="flex flex-col gap-1">
                    {NAV_LINKS.map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="flex min-h-12 items-center rounded-lg px-3 text-base text-[var(--text-primary)] hover:bg-white/5 active:bg-white/10"
                          onClick={() => setOpen(false)}
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <nav aria-label="External" className="flex flex-col border-t border-[var(--border-color)] pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Ecosystem
                  </p>
                  <ul className="flex flex-col gap-1">
                    <li>
                      <a
                        href={WALLET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 items-center rounded-lg px-3 text-base text-[var(--text-primary)] hover:bg-white/5"
                        onClick={() => setOpen(false)}
                      >
                        Wallet (boing.express)
                      </a>
                    </li>
                    <li>
                      <a
                        href={NETWORK_FAUCET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 items-center rounded-lg px-3 text-base text-[var(--text-primary)] hover:bg-white/5"
                        onClick={() => setOpen(false)}
                      >
                        Get testnet BOING
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
