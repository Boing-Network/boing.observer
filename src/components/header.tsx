"use client";

import Link from "next/link";
import { NETWORK_FAUCET_URL, WALLET_URL } from "@/lib/constants";
import { MobileMenu } from "@/components/mobile-menu";
import { NavMenuDropdown } from "@/components/nav-menu-dropdown";
import { SiteLogo } from "@/components/site-logo";
import { NetworkSelector } from "./network-selector";
import { SearchBar } from "./search-bar";

const EXPLORE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/qa", label: "QA" },
] as const;

const INDEX_LINKS = [
  { href: "/tokens", label: "Token index (block scan)" },
  { href: "/dex/tokens", label: "DEX tokens (RPC)" },
  { href: "/dex/pools", label: "DEX pools & directory" },
  { href: "/dex/quote", label: "DEX quotes" },
] as const;

const ECOSYSTEM_LINKS = [
  { href: WALLET_URL, label: "Wallet (boing.express)", external: true },
  { href: NETWORK_FAUCET_URL, label: "Faucet", external: true },
] as const;

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] backdrop-blur-xl"
      role="banner"
    >
      <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:gap-x-3 sm:px-6 lg:h-14 lg:flex-nowrap lg:py-0">
        <SiteLogo className="shrink-0" />

        <nav
          className="hidden shrink-0 items-center gap-x-1 lg:flex xl:gap-x-2"
          aria-label="Main navigation"
        >
          <NavMenuDropdown label="Explore" items={EXPLORE_LINKS} />
          <NavMenuDropdown label="Tokens & DEX" items={INDEX_LINKS} />
          <Link href="/tools" className="nav-link whitespace-nowrap px-1 py-2 text-sm">
            Tools
          </Link>
          <NavMenuDropdown label="Ecosystem" items={ECOSYSTEM_LINKS} />
        </nav>

        <div
          className="order-last hidden min-w-0 flex-1 basis-full justify-center px-0 sm:px-2 md:order-none md:flex md:min-w-[10rem] md:max-w-xl md:basis-auto lg:min-w-[12rem] lg:max-w-2xl lg:flex-1"
          role="search"
        >
          <SearchBar className="max-w-none" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NetworkSelector />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
