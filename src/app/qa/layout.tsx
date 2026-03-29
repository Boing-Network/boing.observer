import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "QA transparency",
  description:
    "Public governance QA pool status on Boing Network: live queue, vote tallies, and pool parameters from the node. Protocol QA (allow / reject / unsure) explained with links to specs.",
  openGraph: {
    title: "QA transparency | Boing Observer",
    description:
      "See the community QA pool queue, governance parameters, and how protocol quality assurance works on Boing Network.",
  },
  alternates: {
    canonical: `${SITE_URL}/qa`,
  },
  keywords: [
    "Boing QA",
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
