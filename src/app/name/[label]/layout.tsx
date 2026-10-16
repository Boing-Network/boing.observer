import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

type Props = { params: Promise<{ label: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { label } = await params;
  const name = `${decodeURIComponent(label).toLowerCase().replace(/\.boing$/, "")}.boing`;
  const title = `${name}`;
  const description = `${name} on Boing Network: owner, the address it resolves to, and expiry.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/name/${encodeURIComponent(label)}` },
  };
}

export default function NameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}