"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteLogo } from "@/components/site-logo";
import { NAV_GROUPS, navItemIsActive } from "@/lib/nav";

export function SidebarNav() {
  const pathname = usePathname() || "/";
  const asideRef = useRef<HTMLElement>(null);

  function handleMouseLeave() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && asideRef.current?.contains(active)) {
      active.blur();
    }
  }

  return (
    <aside
      ref={asideRef}
      className="sidebar-nav fixed inset-y-0 left-0 z-[60] hidden flex-col border-r border-[var(--nav-border)] bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:flex"
      aria-label="Primary"
      onMouseLeave={handleMouseLeave}
    >
      <div className="sidebar-nav-clip">
        <div className="sidebar-nav-panel flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center border-b border-[var(--nav-border)] px-4 lg:h-16">
            <SiteLogo className="min-w-0" />
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4" aria-label="Main navigation">
            <ul className="flex flex-col gap-6">
              {NAV_GROUPS.map((group) => (
                <li key={group.id}>
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = navItemIsActive(pathname, item);
                      const className = `flex min-h-10 items-center rounded-lg px-3 text-sm transition-colors ${
                        active
                          ? "bg-network-cyan/10 font-semibold text-network-cyan"
                          : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                      }`;
                      return (
                        <li key={item.href}>
                          {item.external ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={className}
                            >
                              {item.label}
                            </a>
                          ) : (
                            <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
                              {item.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
}
