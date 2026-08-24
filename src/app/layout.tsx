import type { Metadata, Viewport } from "next";
import { Comfortaa, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/context/network-context";
import { AppEngraveBackground } from "@/components/app-engrave-background";
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import Link from "next/link";
import { SITE_URL, WEBSITE_URL, WALLET_URL } from "@/lib/constants";

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

/** Enables edge-to-edge layout on notched iOS devices; pairs with safe-area env() in CSS. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
        slogan: "Authentic. Decentralized. Optimal. Quality-Assured.",
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
              <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
              <a
                href="#main-content"
                className="absolute left-[-9999px] top-4 z-[100] rounded-lg px-4 py-2 font-semibold text-boing-black outline-none focus:left-4 focus:bg-network-cyan lg:focus:left-[17rem]"
              >
                Skip to main content
              </a>
              <Header />
              <NetworkStatusBanner />
              <main
                className="app-main-readable mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8"
                id="main-content"
              >
                {children}
              </main>
              <footer className="mt-auto border-t border-[var(--nav-border)] bg-[var(--nav-bg)] px-4 py-6 text-center text-xs text-[var(--text-muted)] backdrop-blur-md sm:px-6 sm:text-sm">
                <p className="mb-2 leading-relaxed">Boing Network — Authentic. Decentralized. Optimal. Quality-Assured.</p>
                <nav aria-label="Site links" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4">
                  <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    boing.network
                  </a>
                  <a href={WALLET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
                    Wallet (boing.express)
                  </a>
                  <Link href="/qa" className="text-network-cyan hover:underline">
                    QA transparency
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
