"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Route-level error boundary: keeps the header, sidebar and footer; only the page body is replaced. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl py-10 text-center" role="alert" aria-labelledby="route-error-title">
      <h1 id="route-error-title" className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        {process.env.NODE_ENV === "development" && error.message
          ? error.message
          : "This page failed to load. It may be a temporary RPC problem; try again."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-[44px] rounded-lg bg-network-primary px-5 font-display text-sm font-semibold text-[#050A1A] hover:bg-network-primary-light focus:outline-none focus:ring-2 focus:ring-network-cyan"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border-color)] px-5 text-sm text-network-cyan hover:border-[var(--border-hover)]"
        >
          Go home
        </Link>
      </div>
    </section>
  );
}
