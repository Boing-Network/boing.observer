import Link from "next/link";
import { Fragment } from "react";

export type Crumb = {
  label: string;
  href?: string;
};

export function ExplorerCrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="breadcrumb-list text-[var(--text-muted)]">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? (
              <li aria-hidden="true" className="select-none">
                /
              </li>
            ) : null}
            <li className={item.href ? undefined : "text-[var(--text-primary)]"}>
              {item.href ? (
                <Link href={item.href} className="text-network-cyan hover:underline">
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
