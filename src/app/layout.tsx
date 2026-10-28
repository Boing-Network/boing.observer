import type { Metadata, Viewport } from "next";
import { Comfortaa, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/context/network-context";
import { AppEngraveBackground } from "@/components/app-engrave-background";
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { CollaborationBanner } from "@/components/collaboration-banner";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { ChainIdleNotice } from "@/components/chain-idle-notice";
import { NetworkLinkNotice } from "@/components/network-link-notice";
import Link from "next/link";
import { SITE_URL, WEBSITE_URL, WALLET_URL, FINANCE_URL, DISCORD_URL } from "@/lib/constants";
import { BRAND } from "@/lib/brand";
import { TestnetStatus } from "@/components/testnet-status";

// Required by the enforcing nonce CSP (src/middleware.ts, src/lib/csp.ts): Next stamps its inline bootstrap scripts
// with the per-request nonce only when HTML is rendered per request. Prerendered HTML has no nonce, so every page
// would lose hydration under `script-src 'nonce-...' 'strict-dynamic'`. Cost: SSR on each page request and no CDN
// caching of HTML (static assets under /_next/static stay immutable-cached).
export const dynamic = "force-dynamic";

const comfortaa = Comfortaa({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-comfortaa",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Verification codes from Google Search Console, Bing Webmaster Tools, etc.
// Set in env: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, NEXT_PUBLIC_BING_SITE_VERIFICATION
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;

const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Boing Observer — See what happens on-chain",
};

/** Enables edge-to-edge layout on notched iOS devices; pairs with safe-area env() in CSS. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050A1A",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Boing Observer — See what happens on-chain",
    template: "%s | Boing Observer",
  },
  description:
    "Boing Observer — an explorer with integrated QA transparency. See accounts, blocks, and transactions on Boing Network. Public testnet — mainnet not live. The Boing Quality Gate screens deployments before they reach the ledger.",
  keywords: [
    "Boing Network",
    "Boing Observer",
    "block explorer",
    "blocks",
    "transactions",
    "accounts",
    "Boing",
    "testnet",
    "Boing Quality Gate",
    "quality assurance",
    "transparency",
    "DEX",
  ],
  authors: [{ name: "Boing Network", url: WEBSITE_URL }],
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
    title: "Boing Observer — See what happens on-chain",
    description:
      "An explorer with integrated QA transparency for Boing Network. Public testnet — mainnet not live.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boing Observer — See what happens on-chain",
    description: `${BRAND.observerBoundary} ${BRAND.testnetStatus}.`,
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
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
        description: BRAND.observerBoundary,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Boing Network",
        url: WEBSITE_URL,
        slogan: BRAND.tagline,
        description: BRAND.core,
        logo: `${SITE_URL}/icon-512.png`,
        image: `${SITE_URL}/og.png`,
        sameAs: [WEBSITE_URL, WALLET_URL, FINANCE_URL, DISCORD_URL],
      },
    ],
  };

  return (
    <html lang="en" className={`min-h-full font-sans ${comfortaa.variable} ${jetbrainsMono.variable}`}>
      <body className="app-page-canvas min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <NetworkProvider>
          <div className="app-shell-root min-h-full">
            <AppEngraveBackground />
            <div className="relative z-10 flex min-h-screen">
              <SidebarNav />
              <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-4">
              <a
                href="#main-content"
                className="absolute left-[-9999px] top-4 z-[100] rounded-lg px-4 py-2 font-semibold text-boing-black outline-none focus:left-4 focus:bg-network-cyan"
              >
                Skip to main content
              </a>
              <CollaborationBanner />
              <Header />
              <NetworkStatusBanner />
              <ChainIdleNotice />
              <NetworkLinkNotice />
              <main
                className="app-main-readable mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8"
                id="main-content"
              >
                {children}
              </main>
              <footer className="mt-auto border-t border-[var(--nav-border)] bg-[var(--nav-bg)] px-4 py-6 text-center text-xs text-[var(--text-muted)] backdrop-blur-md sm:px-6 sm:text-sm">
                <p className="mb-2 leading-relaxed">{BRAND.tagline}</p>
                <div className="mb-3 flex justify-center">
                  <TestnetStatus />
                </div>
                <nav aria-label="Site links" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4">
                  <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    Boing Network
                  </a>
                  <a href={WALLET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    Boing Express
                  </a>
                  <a href={FINANCE_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    Boing Finance
                  </a>
                  <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    Discord
                  </a>
                  <Link href="/qa" className="text-network-cyan hover:underline">
                    Quality Gate
                  </Link>
                  <Link href="/tools" className="text-network-cyan hover:underline">
                    Tools
                  </Link>
                  <Link href="/dex/pools" className="text-network-cyan hover:underline">
                    DEX directory
                  </Link>
                  <Link href="/tools/node-health" className="text-network-cyan hover:underline">
                    Node health
                  </Link>
                </nav>
              </footer>
              </div>
            </div>
          </div>
        </NetworkProvider>
      </body>
    </html>
  );
}
