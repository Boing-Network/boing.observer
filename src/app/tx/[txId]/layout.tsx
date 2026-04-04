import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { buildBreadcrumbJsonLd, toSafeJsonScript } from "@/lib/breadcrumb-jsonld";
import { normalizeHex64 } from "@/lib/rpc-types";

type Props = {
  params: Promise<{ txId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { txId: raw } = await params;
  const id = normalizeHex64(raw);
  const short = id.length > 16 ? `${id.slice(0, 16)}…` : id || raw;
  const title = id ? `Transaction ${short}` : "Transaction";
  const description = id
    ? `Inspect Boing transaction ${short}: transfers, parties, execution receipt, and inclusion block.`
    : "Inspect a Boing transaction by its 32-byte transaction id.";
  const path = id ? `/tx/${id}` : "/tx";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}${path}` },
  };
}

export default async function TxLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ txId: string }>;
}) {
  const { txId: raw } = await params;
  const id = normalizeHex64(raw);
  const short = id.length > 16 ? `${id.slice(0, 16)}…` : id || raw;
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: id ? `Transaction ${short}` : "Transaction", url: id ? `${SITE_URL}/tx/${id}` : `${SITE_URL}/tx` },
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
