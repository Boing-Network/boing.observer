import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

type Props = { params: Promise<{ contract: string; itemId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contract, itemId } = await params;
  const short = contract.length > 12 ? `${contract.slice(0, 12)}…` : contract;
  const title = `Item #${itemId}`;
  const description = `Game item type #${itemId} in Boing multi-token collection ${short}: supply, metadata and holders.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/items/${contract}/${itemId}` },
  };
}

export default function ItemTypeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
