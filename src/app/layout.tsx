import type { Metadata } from "next";
import "./globals.css";
import { NetworkProvider } from "@/context/network-context";
import { Header } from "@/components/header";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { SITE_URL, WEBSITE_URL, WALLET_URL } from "@/lib/constants";

// Verification codes from Google Search Console, Bing Webmaster Tools, etc.
// Set in env: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, NEXT_PUBLIC_BING_SITE_VERIFICATION
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Boing Observer — Blockchain Explorer | Boing Network",
    template: "%s | Boing Observer",
  },
  description:
    "Explore blocks, transactions, and accounts on Boing Network. Browse Boing testnet today, with mainnet support enabled when configured. Search by block height, block hash, or account address at boing.observer.",
  keywords: [
    "Boing Network",
    "blockchain explorer",
    "blocks",
    "transactions",
    "accounts",
    "Boing",
    "crypto",
    "block explorer",
    "testnet",
    "mainnet",
    "quality assurance",
    "consensus",
    "True QA",
  ],
  authors: [{ name: "Boing Network", url: SITE_URL }],
  creator: "Boing Network",
  publisher: "Boing Network",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Boing Observer",
    title: "Boing Observer — Blockchain Explorer | Boing Network",
    description:
      "Explore blocks, transactions, and accounts on Boing Network. Browse Boing testnet today, with mainnet support enabled when configured.",
  },
  twitter: {
    card: "summary",
    title: "Boing Observer — Blockchain Explorer | Boing Network",
    description: "Explore blocks, transactions, and accounts on Boing Network.",
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.json",
  ...((googleVerification || bingVerification) && {
    verification: {
      ...(googleVerification && { google: googleVerification }),
      ...(bingVerification && { other: { "msvalidate.01": bingVerification } }),
    },
  }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Boing Observer",
        description: "Blockchain explorer for Boing Network. Browse blocks, transactions, and accounts.",
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Boing Network",
          url: SITE_URL,
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Boing Network",
        url: SITE_URL,
        slogan: "Authentic. Decentralized. Optimal. Sustainable.",
      },
    ],
  };

  return (
    <html lang="en" className="min-h-full">
      <body className="min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <NetworkProvider>
          <Header />
          <NetworkStatusBanner />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6" role="main" id="main-content">{children}</main>
          <footer className="mt-auto border-t border-[var(--border-color)] py-6 text-center text-sm text-[var(--text-muted)]">
            <p className="mb-2">Boing Network — Authentic. Decentralized. Optimal. Sustainable.</p>
            <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">boing.network</a>
              <a href={WALLET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">Wallet (boing.express)</a>
            </p>
          </footer>
        </NetworkProvider>
      </body>
    </html>
  );
}
