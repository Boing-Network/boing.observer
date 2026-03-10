/**
 * Shared breadcrumb JSON-LD for block and account layouts.
 * Used for SEO and rich results; escapes </script> in JSON for safe injection.
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Escape JSON for use inside <script> to avoid breaking out of the tag. */
export function toSafeJsonScript(json: object): string {
  return JSON.stringify(json).replace(/</g, "\\u003c");
}
