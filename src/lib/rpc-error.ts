/**
 * Structured JSON-RPC errors. `rpcCall` throws {@link BoingRpcCallError} so callers can branch on the node's
 * numeric `code` and `data` (notably `data.reason` for `boing_submitTransaction` rejections) instead of parsing
 * message strings. It is still an `Error` with the node's message, so existing `e.message` handling works.
 *
 * Contract: boing.network `docs/RPC-API-SPEC.md` (submitTransaction rejection reasons) and
 * `docs/BOING-RPC-ERROR-CODES-FOR-DAPPS.md`.
 */
import { formatBoingBase } from "./native-unit";

export class BoingRpcCallError extends Error {
  readonly name = "BoingRpcCallError";
  /** JSON-RPC `error.code`, or `null` for transport failures (HTTP status, invalid JSON). */
  readonly code: number | null;
  /** JSON-RPC `error.data` (object for Boing rejections), if any. */
  readonly data: unknown;
  readonly method: string | null;
  /** HTTP status when the failure came from the transport layer. */
  readonly httpStatus: number | null;
  /** `Retry-After` seconds when the proxy rate-limited the request. */
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    opts: {
      code?: number | null;
      data?: unknown;
      method?: string | null;
      httpStatus?: number | null;
      retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(message);
    this.code = opts.code ?? null;
    this.data = opts.data;
    this.method = opts.method ?? null;
    this.httpStatus = opts.httpStatus ?? null;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    Object.setPrototypeOf(this, BoingRpcCallError.prototype);
  }
}

export type RpcErrorLike = { code?: unknown; message?: unknown; data?: unknown };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Pull `{code, message, data}` out of a BoingRpcCallError, a wallet/provider error, or a raw JSON-RPC `error`. */
export function toRpcErrorLike(err: unknown): { code: number | null; message: string; data: unknown } | null {
  const o = asRecord(err);
  if (!o) return null;
  // Boing Express nests the node's error under `data.rpc` (see mapWalletErrorToUi).
  const nested = asRecord(asRecord(o.data)?.rpc);
  const src = nested ?? o;
  const code = typeof src.code === "number" ? src.code : typeof o.code === "number" ? (o.code as number) : null;
  const message = typeof src.message === "string" ? src.message : typeof o.message === "string" ? (o.message as string) : "";
  const data = nested ? nested.data : o.data;
  return { code, message, data };
}

/** `data.reason` of a rejection, if present. */
export function rpcErrorReason(err: unknown): string | null {
  const like = toRpcErrorLike(err);
  const reason = asRecord(like?.data)?.reason;
  return typeof reason === "string" && reason ? reason : null;
}

function fmtLedger(raw: unknown): string | null {
  if (typeof raw === "string" && /^\d{1,39}$/.test(raw)) return `${formatBoingBase(raw)} BOING`;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return `${formatBoingBase(BigInt(raw))} BOING`;
  return null;
}

function num(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string" && /^\d{1,20}$/.test(raw)) return raw;
  return null;
}

/**
 * Plain-language message for a node rejection (`boing_submitTransaction`, `boing_qaPoolVote`, faucet, ...).
 * Returns `null` when the error carries no recognised code or reason, so callers can fall back to the
 * node's own message.
 */
export function describeRpcRejection(err: unknown): string | null {
  const like = toRpcErrorLike(err);
  if (!like) return null;
  const data = asRecord(like.data);
  const reason = typeof data?.reason === "string" ? data.reason : null;

  switch (reason) {
    case "unknown_sender":
      return "This account has no balance on-chain yet, so the network does not know it. Fund it first (on testnet, use the faucet), then try again.";
    case "stale_nonce": {
      const expected = num(data?.expected_nonce);
      const got = num(data?.got_nonce);
      const detail = expected != null && got != null ? ` (the network expects nonce ${expected}, the transaction used ${got})` : "";
      return `The transaction nonce is out of date${detail}. Refresh the account nonce and sign the transaction again.`;
    }
    case "insufficient_fee": {
      const have = fmtLedger(data?.have);
      const need = fmtLedger(data?.need);
      const detail = have && need ? ` Balance ${have}, needed ${need} (network fee plus any priority tip).` : "";
      return `Not enough BOING to cover the network fee.${detail} Add funds (testnet faucet) and retry.`;
    }
    case "already_in_mempool":
      return "This exact transaction is already pending. Wait for the next block instead of resubmitting.";
    case "free_pending_limit":
      return "Too many zero-tip transactions are pending for this account. Wait for them to confirm or attach a priority tip.";
    case "free_tx_balance_gate":
      return "This account does not hold enough BOING for a fee-waived transaction. Add funds or attach a priority tip.";
    case "native_value_not_active":
      return "Native value transfers inside contract calls are not active at the current block height.";
    case "pool_full":
      return "The QA review pool is full right now. Try again shortly.";
    case "deployer_cap":
      return "This deployer already has the maximum number of items in the QA review pool.";
    default:
      break;
  }

  switch (like.code) {
    case -32016:
      return "The faucet is rate-limited for this account. Wait about a minute and try again.";
    case -32050: {
      const rule = typeof data?.rule_id === "string" ? ` (rule ${data.rule_id})` : "";
      const msg = typeof data?.message === "string" && data.message ? ` ${data.message}` : "";
      return `Quality assurance rejected this deployment${rule}.${msg}`.trim();
    }
    case -32051:
      return "Quality assurance could not decide; the deployment was sent to the governance review pool.";
    case -32052:
      return "No pending QA item was found for that transaction hash.";
    case -32053:
      return "This account is not eligible to vote on that QA item (not a pool member, own deployment, or stake below the minimum).";
    case -32054:
      return "The QA review pool is disabled by governance.";
    case -32055:
      return "The QA review pool is full right now. Try again shortly.";
    case -32056:
      return "This deployer already has the maximum number of items in the QA review pool.";
    case -32057:
      return "This operator action needs a valid operator token.";
    default:
      return null;
  }
}

export function isRateLimitedError(err: unknown): boolean {
  return err instanceof BoingRpcCallError && err.httpStatus === 429;
}