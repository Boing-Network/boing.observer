/**
 * Shared product language for Boing Observer.
 * Sibling sites (boing.network, boing.express, boing.finance) use the same names and lines.
 */

export const BRAND = {
  networkName: "Boing Network",
  observerName: "Boing Observer",
  expressName: "Boing Express",
  financeName: "Boing Finance",

  core: "Boing is an independent Layer 1 where quality is enforced by the protocol.",
  primaryMessage: "Quality assurance, enforced by the protocol.",
  tagline: "Boing Network — Quality, enforced by the protocol.",

  observerLine: "See what happens on-chain",
  observerBoundary: "Boing Observer — an explorer with integrated QA transparency.",
  expressLine: "Your gateway to Boing",
  financeLine: "Move liquidity across chains",
  networkLine: "Core protocol",

  promise:
    "Boing makes on-chain participation more verifiable by enforcing quality checks at the protocol layer.",

  qualityGateName: "Boing Quality Gate",
  qualityGateSummary:
    "The Boing Quality Gate screens deployments against transparent rules before they reach the ledger. Automated checks handle clear cases. A decentralized community pool reviews edge cases.",
  transparentDefault: "Transparent by default — observable rules, deployments and outcomes.",
  outcomesVisible: "Outcomes remain visible and auditable.",
  reduceMalicious:
    "Designed to reduce malicious, deceptive and low-quality deployments through transparent, protocol-level checks.",
  protocolChecks:
    "Boing introduces protocol-level deployment checks designed to identify and restrict deployments that fail transparent quality criteria before they are accepted on-chain.",

  testnetStatus: "Public testnet — mainnet not live",
  verifiability: "Designed for verifiability and institutional review.",
} as const;

export const BOING_APPS = [
  { name: BRAND.networkName, desc: BRAND.networkLine, href: "https://boing.network" },
  { name: BRAND.expressName, desc: BRAND.expressLine, href: "https://boing.express" },
  { name: BRAND.financeName, desc: BRAND.financeLine, href: "https://boing.finance" },
  { name: BRAND.observerName, desc: BRAND.observerLine, href: "https://boing.observer" },
] as const;
