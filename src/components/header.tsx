"use client";

import Link from "next/link";
import { NETWORK_FAUCET_URL, WALLET_URL } from "@/lib/constants";
import { MobileMenu } from "@/components/mobile-menu";
import { SiteLogo } from "@/components/site-logo";
import { NetworkSelector } from "./network-selector";
import { SearchBar } from "./search-bar";

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] backdrop-blur-xl"
      role="banner"
    >
      <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:gap-x-3 sm:px-6 lg:h-14 lg:flex-nowrap lg:py-0">
        <SiteLogo className="shrink-0" />

        <nav
          className="hidden shrink-0 items-center gap-x-2 lg:flex xl:gap-x-4"
          aria-label="Main navigation"
        >
          <Link href="/" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            Home
          </Link>
          <Link href="/about" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            About
          </Link>
          <Link href="/qa" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            QA
          </Link>
          <Link href="/tools" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            Tools
          </Link>
          <Link href="/dex/pools" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            DEX
          </Link>
          <a
            href={WALLET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link whitespace-nowrap px-1 py-2 text-sm"
          >
            Wallet
          </a>
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link whitespace-nowrap px-1 py-2 text-sm"
          >
            Faucet
          </a>
        </nav>

        <div
          className="order-last hidden min-w-0 flex-1 justify-center px-2 lg:order-none lg:flex lg:max-w-md lg:flex-1"
          role="search"
        >
          <SearchBar className="w-full" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NetworkSelector />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
