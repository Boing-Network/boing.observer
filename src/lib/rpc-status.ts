/**
 * RPC connectivity helpers for friendly error messages.
 * Used when Boing Network nodes are not yet available (e.g. before incentivized testnet launch).
 */

export function isRpcUnreachableError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("load failed") ||
    lower.includes("network request failed") ||
    lower.includes("cors") ||
    lower.includes("cross-origin") ||
    lower.includes("connection refused") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("timeout") ||
    lower.includes("rpc http 502") ||
    lower.includes("rpc http 503") ||
    lower.includes("rpc http 504") ||
    lower.includes("rpc http 530") ||
    lower.includes("rpc http 0")
  );
}

const NODES_UNAVAILABLE_MESSAGE =
  "Boing Network nodes are not yet available for this network. " +
  "The RPC may be unreachable or CORS may be blocking requests.";

/**
 * Returns a user-friendly message for RPC errors.
 * When the error indicates unreachable nodes, shows the "no nodes available" message.
 */
export function getFriendlyRpcErrorMessage(
  error: unknown,
  network: "testnet" | "mainnet",
  context?: "block" | "account" | "stats" | "general"
): string {
  if (!error) return "Something went wrong.";
  const msg = error instanceof Error ? error.message : String(error);

  if (isRpcUnreachableError(error)) {
    return NODES_UNAVAILABLE_MESSAGE;
  }

  switch (context) {
    case "block":
      return msg || "Failed to load block.";
    case "account":
      return msg || "Failed to load account.";
    case "stats":
      return msg ? `Could not load network stats: ${msg}` : "Could not load network stats.";
    default:
      return msg || "Failed to connect to the network.";
  }
}
