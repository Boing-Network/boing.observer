import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { buildBreadcrumbJsonLd, toSafeJsonScript } from "@/lib/breadcrumb-jsonld";

type Props = {
  params: Promise<{ hash: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const shortHash = hash.length > 16 ? `${hash.slice(0, 16)}...` : hash;
  const title = `Block ${shortHash}`;
  const description = `View block by hash ${shortHash} on Boing Network. See block details and transactions.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/block/hash/${hash}` },
  };
}

export default async function BlockHashLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const shortHash = hash.length > 16 ? `${hash.slice(0, 16)}...` : hash;
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: `Block ${shortHash}`, url: `${SITE_URL}/block/hash/${hash}` },
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
