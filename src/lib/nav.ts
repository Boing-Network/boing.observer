import { DISCORD_URL, FINANCE_URL, NETWORK_FAUCET_URL, WALLET_URL, WEBSITE_URL } from "@/lib/constants";

export type NavItem = {
  href: string;
  label: string;
  external?: boolean;
  /** Match this path only; do not treat child routes as active. */
  exact?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: readonly NavItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "explore",
    label: "Explore",
    items: [
      { href: "/", label: "Home", exact: true },
      { href: "/about", label: "About" },
      { href: "/qa", label: "Quality Gate", exact: true },
      { href: "/qa/rules", label: "Gate rules" },
    ],
  },
  {
    id: "dex",
    label: "Tokens & DEX",
    items: [
      { href: "/tokens", label: "Token index" },
      { href: "/dex/tokens", label: "DEX tokens" },
      { href: "/dex/pools", label: "DEX pools" },
      { href: "/dex/quote", label: "DEX quotes" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { href: "/tools", label: "Tools", exact: true },
      { href: "/tools/rpc-catalog", label: "RPC catalog" },
      { href: "/tools/qa-check", label: "QA pre-flight" },
      { href: "/tools/node-health", label: "Node health" },
    ],
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    items: [
      { href: WEBSITE_URL, label: "Boing Network", external: true },
      { href: WALLET_URL, label: "Boing Express", external: true },
      { href: FINANCE_URL, label: "Boing Finance", external: true },
      { href: NETWORK_FAUCET_URL, label: "Faucet", external: true },
      { href: DISCORD_URL, label: "Discord", external: true },
    ],
  },
] as const;

export function navItemIsActive(pathname: string, item: NavItem): boolean {
  if (item.external) return false;
  if (item.exact || item.href === "/") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
