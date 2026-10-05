import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { buildBreadcrumbJsonLd, toSafeJsonScript } from "@/lib/breadcrumb-jsonld";

type Props = {
  params: Promise<{ address: string; tokenId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address, tokenId } = await params;
  const shortCollection = address.length > 12 ? `${address.slice(0, 12)}…` : address;
  const shortToken = tokenId.length > 12 ? `${tokenId.slice(0, 12)}…` : tokenId;
  const title = `NFT ${shortToken}`;
  const description = `Reference NFT item ${shortToken} in collection ${shortCollection} on Boing Network.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/asset/${address}/item/${tokenId}` },
  };
}

export default async function NftItemLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ address: string; tokenId: string }>;
}) {
  const { address, tokenId } = await params;
  const shortCollection = address.length > 12 ? `${address.slice(0, 12)}…` : address;
  const shortToken = tokenId.length > 12 ? `${tokenId.slice(0, 12)}…` : tokenId;
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: `Collection ${shortCollection}`, url: `${SITE_URL}/asset/${address}` },
    { name: `NFT ${shortToken}`, url: `${SITE_URL}/asset/${address}/item/${tokenId}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toSafeJsonScript(breadcrumb) }}
      />
      {children}
    </>
  );
}
