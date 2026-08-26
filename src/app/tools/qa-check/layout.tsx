import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "QA check",
  description:
    "Run a protocol quality-assurance check on contract bytecode and asset metadata before deploying on Boing Network.",
  openGraph: {
    title: "QA check | Boing Observer",
    description:
      "Validate bytecode and asset metadata against Boing Network quality-assurance rules before deploy.",
  },
  twitter: {
    card: "summary_large_image",
    title: "QA check | Boing Observer",
    description: "Validate bytecode and asset metadata against Boing Network QA rules.",
  },
  alternates: {
    canonical: `${SITE_URL}/tools/qa-check`,
  },
};

export default function QaCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
