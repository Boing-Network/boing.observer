/**
 * Types for Boing JSON-RPC API (see boing-network/docs/RPC-API-SPEC.md).
 */

export type NetworkId = "testnet" | "mainnet";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

/** Block header as returned by node (hex or number per node serialization). */
export interface BlockHeader {
  parent_hash: string;
  height: number;
  timestamp: number;
  proposer: string;
  tx_root: string;
  state_root: string;
}

/** Transaction payload types for display. */
export type TxPayloadKind =
  | "Transfer"
  | "Bond"
  | "Unbond"
  | "ContractCall"
  | "ContractDeploy"
  | "ContractDeployWithPurpose"
  | "ContractDeployWithPurposeAndMetadata"
  | "Unknown";

/** Execution outcome when blocks are fetched with `include_receipts: true`. */
export interface TxLogEntry {
  topics: string[];
  data: string;
}

export interface TransactionReceipt {
  tx_id?: string;
  block_height?: number;
  tx_index?: number;
  success?: boolean;
  gas_used?: number;
  return_data?: string;
  logs?: TxLogEntry[];
  error?: string | null;
}

export interface TxPayloadTransfer {
  to: string;
  amount: string;
}

export interface TxPayloadBond {
  amount: string;
}

export interface TxPayloadUnbond {
  amount: string;
}

export interface TxPayloadContractCall {
  contract: string;
  calldata?: string;
}

export interface TxPayloadContractDeploy {
  bytecode?: string;
}

/** Transaction as in block (node may use different field names). */
export interface BlockTransaction {
  nonce?: number;
  sender: string;
  payload: unknown;
  access_list?: {
    read?: string[];
    write?: string[];
  };
}

/** Block object from boing_getBlockByHeight / boing_getBlockByHash. */
export interface Block {
  hash: string;
  header: BlockHeader;
  transactions: BlockTransaction[];
  /** Present when RPC is called with `include_receipts: true` (same order as `transactions`). */
  receipts?: (TransactionReceipt | null)[] | null;
}

export interface Account {
  balance: string;
  nonce: number;
  stake: string;
}

/** Row from `boing_qaPoolList` (public RPC). */
export interface QaPoolItemSummary {
  tx_hash: string;
  bytecode_hash: string;
  deployer: string;
  allow_votes: number;
  reject_votes: number;
  age_secs: number;
}

export interface QaPoolListResult {
  items: QaPoolItemSummary[];
}

/** Effective governance parameters from `boing_qaPoolConfig`. */
export interface QaPoolConfigResult {
  max_pending_items: number;
  max_pending_per_deployer: number;
  review_window_secs: number;
  quorum_fraction: number;
  allow_threshold_fraction: number;
  reject_threshold_fraction: number;
  default_on_expiry: "reject" | "allow";
  dev_open_voting: boolean;
  administrator_count: number;
  accepts_new_pending: boolean;
  pending_count: number;
}

/** Result of `boing_getQaRegistry` (read-only). */
export interface QaRegistryResult {
  max_bytecode_size: number;
  blocklist: number[][];
  scam_patterns: number[][];
  always_review_categories: string[];
  content_blocklist: string[];
}

const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Safely convert any RPC value (string, number, byte array, object) to a hex string
 * for display and URLs. Handles null/undefined and non-string serializations.
 */
export function toSafeHexString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toString(16);
  // Byte array from RPC (e.g. AccountId as [u8; 32])
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return "0x" + value.map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as Uint8Array;
    return "0x" + Array.from(view)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  return String(value).trim();
}

/**
 * Normalize hex for links: strip 0x and return lowercase. Safe for any RPC value.
 */
export function hexForLink(value: unknown): string {
  const s = toSafeHexString(value);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  return h.toLowerCase();
}

/** Strip an optional 0x prefix and trim whitespace. */
export function stripHexPrefix(value: string): string {
  return value.trim().replace(/^0x/i, "");
}

/** Returns true when the input is exactly 32 bytes of hex (64 chars, optional 0x). */
export function isHex64(value: string): boolean {
  return HEX_64_RE.test(stripHexPrefix(value));
}

/** Normalize a 32-byte hex input for routing and RPC usage. Returns empty string if invalid. */
export function normalizeHex64(value: string): string {
  const hex = stripHexPrefix(value);
  return HEX_64_RE.test(hex) ? hex.toLowerCase() : "";
}

/** Convert a 32-byte hex input to 0x-prefixed lowercase form. Returns empty string if invalid. */
export function toPrefixedHex64(value: string): string {
  const hex = normalizeHex64(value);
  return hex ? `0x${hex}` : "";
}

/** Normalize address to 64 hex chars (no 0x) for links and display. */
export function normalizeAddress(addr: string): string {
  const hex = stripHexPrefix(addr);
  return hex.padStart(64, "0").toLowerCase().slice(-64);
}

/** Native BOING balances from RPC are whole units (u128), not 10^-18 fractions. */
const DECIMALS = 0;

export function formatBalance(raw: string, decimals: number = DECIMALS): string {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return raw;
  if (s === "0") return "0";
  if (decimals <= 0) {
    return s.replace(/^0+/, "") || "0";
  }
  let padded = s.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals).replace(/^0+/, "") || "0";
  const fracPart = padded.slice(-decimals).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

/** Shorten hash/address for display (first 10 + ... + last 8). Accepts any value; safely coerces. */
export function shortenHash(hash: unknown, head = 10, tail = 8): string {
  const s = toSafeHexString(hash);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  if (h.length <= head + tail) return s || "—";
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}
