import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Quality Gate",
  description:
    "The Boing Quality Gate screens deployments against transparent rules before they reach the ledger. Automated checks handle clear cases. A community pool reviews edge cases. Outcomes stay visible. Public testnet — mainnet not live.",
  openGraph: {
    title: "Boing Quality Gate | Boing Observer",
    description:
      "Transparent by default — observable rules, deployments and outcomes on Boing Network. Public testnet — mainnet not live.",
  },
  alternates: {
    canonical: `${SITE_URL}/qa`,
  },
  keywords: [
    "Boing Quality Gate",
    "quality assurance",
    "governance pool",
    "transparency",
    "testnet",
    "Boing Network",
  ],
};

export default function QaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
