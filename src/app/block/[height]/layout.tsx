import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { buildBreadcrumbJsonLd, toSafeJsonScript } from "@/lib/breadcrumb-jsonld";

type Props = {
  params: Promise<{ height: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { height } = await params;
  const title = `Block #${height}`;
  const description = `View block ${height} on Boing Network. See block header, transactions, proposer, and more.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/block/${height}` },
  };
}

export default async function BlockLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ height: string }>;
}) {
  const { height } = await params;
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: `Block #${height}`, url: `${SITE_URL}/block/${height}` },
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
