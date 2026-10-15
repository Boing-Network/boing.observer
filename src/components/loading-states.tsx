import { WEBSITE_URL } from "@/lib/constants";

/** Pulsing placeholder bar used while RPC data loads. */
export function Skeleton({ className = "h-4 w-24" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block animate-pulse rounded bg-white/10 ${className}`} />;
}

/** Shown when the public RPC can't be reached: message, retry, and a link to network status. */
export function RpcDownNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card space-y-2 border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200" role="alert">
      <p>{message}</p>
      <p className="flex flex-wrap gap-3">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="text-network-cyan hover:underline">
            Retry
          </button>
        ) : null}
        <a href={`${WEBSITE_URL}/status`} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
          Network status
        </a>
      </p>
    </div>
  );
}