import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Testnet faucet",
  description:
    "Request testnet BOING for a Boing Network account. Public testnet — mainnet not live.",
  openGraph: {
    title: "Testnet faucet | Boing Observer",
    description:
      "Request testnet BOING for a Boing Network account from the official observer faucet.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Testnet faucet | Boing Observer",
    description: "Request testnet BOING for a Boing Network account.",
  },
  alternates: {
    canonical: `${SITE_URL}/faucet`,
  },
};

export default function FaucetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
