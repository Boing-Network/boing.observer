import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Quality Gate pre-flight",
  description:
    "Pre-flight a deployment against the Boing Quality Gate. See whether bytecode and metadata would be Allowed, Rejected, or sent to the community pool before you submit. Public testnet — mainnet not live.",
  openGraph: {
    title: "Quality Gate pre-flight | Boing Observer",
    description:
      "Screen bytecode and metadata against transparent Boing Quality Gate rules before a deployment reaches the ledger.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quality Gate pre-flight | Boing Observer",
    description: "Screen bytecode and metadata against the Boing Quality Gate before you submit.",
  },
  alternates: {
    canonical: `${SITE_URL}/tools/qa-check`,
  },
};

export default function QaCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
