"use client";

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
      <div className="flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:gap-x-4 sm:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
        <SiteLogo className="shrink-0" />

        <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0" role="search">
          <SearchBar className="w-full max-w-none" size="lg" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <NetworkSelector />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
