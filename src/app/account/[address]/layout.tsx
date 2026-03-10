import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { buildBreadcrumbJsonLd, toSafeJsonScript } from "@/lib/breadcrumb-jsonld";

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const shortAddr = address.length > 16 ? `${address.slice(0, 16)}...` : address;
  const title = `Account ${shortAddr}`;
  const description = `View account ${shortAddr} on Boing Network. Check balance, nonce, and stake.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    alternates: { canonical: `${SITE_URL}/account/${address}` },
  };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const shortAddr = address.length > 16 ? `${address.slice(0, 16)}...` : address;
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: `Account ${shortAddr}`, url: `${SITE_URL}/account/${address}` },
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
