"use client";

import "./globals.css";
import { AppStoneBackground } from "@/components/app-stone-background";

/**
 * Replaces the root layout when an uncaught error bubbles to the root.
 * Must define html/body and repeat the shared graphic shell so the look matches other routes.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="min-h-full">
      <body className="app-page-canvas min-h-full antialiased">
        <AppStoneBackground />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Something went wrong</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {process.env.NODE_ENV === "development" && error.message ? error.message : "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="rounded-lg border border-[var(--border-color)] bg-[rgba(8,13,26,0.85)] px-4 py-2 text-sm font-medium text-network-cyan transition-colors hover:border-[var(--border-hover)] hover:text-network-cyan-light"
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
