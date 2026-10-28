/** Shown while a route segment streams in. Reserves roughly the final height so the footer does not jump. */
export default function Loading() {
  return (
    <div className="min-h-[60vh] animate-pulse space-y-4" role="status" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-56 rounded bg-white/5" />
      <div className="h-4 w-full max-w-xl rounded bg-white/5" />
      <div className="h-40 rounded-xl bg-white/5" />
      <div className="h-40 rounded-xl bg-white/5" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
