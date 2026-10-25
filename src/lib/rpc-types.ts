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
  /** Merkle root of execution receipts (always present on current nodes). */
  receipts_root?: string;
  /** Root of media-blob commitments; omitted when the block carries no blob operations. */
  blobs_root?: string;
}

/**
 * Transaction payload types for display.
 * Aligns with `@boing-network/boing-sdk` `PayloadVariant` (ContractCallWithValue → ContractCall).
 */
export type TxPayloadKind =
  | "Transfer"
  | "Bond"
  | "Unbond"
  | "ClaimUnbond"
  | "QaPoolVote"
  | "ContractCall"
  | "Batch"
  | "ContractDeploy"
  | "ContractDeployWithPurpose"
  | "ContractDeployWithPurposeAndMetadata"
  | "ValidatorRegister"
  | "ValidatorDeregister"
  | "ValidatorUnjail"
  | "NameCommit"
  | "NameRegister"
  | "NameRenew"
  | "NameTransfer"
  | "NameSetTarget"
  | "NameSetPrimary"
  | "NameRelease"
  | "PutBlob"
  | "BlobAnnounce"
  | "RenewMediaBlobPin"
  | "PayBlobSample"
  | "RegisterBlobSampleOffer"
  | "SettleBlobSampleMatch"
  | "CancelBlobSampleOffer"
  | "ChallengeBlobSampleServe"
  | "RespondBlobSampleServe"
  | "SubmitSlashAppeal"
  | "ResolveSlashAppeal"
  | "ResolveSlashAppealAttested"
  | "ResolveSlashAppealBlsAggregate"
  | "GrantBlobDownload"
  | "RevokeBlobDownload"
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
  /** Native BOING sent with the call (`ContractCallWithValue`, from the native-value height; ledger units). */
  value?: string;
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
  /** Validator signatures over the block (hex, 64 bytes each); omitted when empty. */
  signatures?: string[];
  /**
   * Optional per-transaction priority tips (ledger units, same order as `transactions`).
   * Each entry is a JSON number, or a decimal string above 2^53-1 (u128). Omitted when no tx tipped.
   */
  priority_tips?: Array<string | number>;
}

/** Result of `boing_getSyncState` (committed tip; head vs finalized may diverge in future). */
export interface BoingSyncState {
  head_height: number;
  finalized_height: number;
  latest_block_hash: string;
}

/** Result of `boing_health` (liveness + RPC limits snapshot; shape may grow with node). */
export interface BoingHealthRpcSurface {
  jsonrpc_batch_max?: number;
  get_logs_max_block_range?: number;
  get_logs_max_results?: number;
  http_max_body_megabytes?: number;
  http_rate_limit_requests_per_sec?: number;
  websocket_max_connections?: number;
  ready_min_peers?: number | null;
  max_log_topic_filters?: number;
}

export interface BoingHealthRpcMetrics {
  rate_limited_total?: number;
  json_parse_errors_total?: number;
  batch_too_large_total?: number;
  method_not_found_total?: number;
  websocket_cap_rejects_total?: number;
}

export interface BoingHealth {
  ok?: boolean;
  client_version?: string;
  chain_id?: number | null;
  chain_name?: string | null;
  head_height?: number;
  rpc_surface?: BoingHealthRpcSurface;
  rpc_metrics?: BoingHealthRpcMetrics;
  /** Advisory wallet/SDK version hints (never enforced; operators can override them). */
  client_hints?: BoingClientHints;
}

/** `client_hints` from `boing_health` / `boing_getNetworkInfo`. All fields optional: older nodes omit them. */
export interface BoingClientHints {
  min_wallet_version?: string;
  recommended_wallet_version?: string;
  recommended_sdk?: string;
  sdk_npm_package?: string;
  note?: string;
}

export interface Account {
  /** Ledger units: base units (1 BOING = 10^18) when `decimals` is 18, whole BOING when 0 / absent. */
  balance: string;
  nonce: number;
  stake: string;
  /** Ledger decimals of `balance` / `stake` (testnet-v0.1.17+ nodes; older nodes omit it = whole BOING). */
  decimals?: number;
  balance_boing?: string;
  stake_boing?: string;
  /** Stake in the unbonding queue (ledger units); "0" when none. */
  pending_unbond?: string;
  pending_unbond_boing?: string;
  /** Height at which `pending_unbond` can be claimed (`ClaimUnbond`); 0 when nothing is pending. */
  unbond_unlock_height?: number;
}

/** Row from `boing_qaPoolList` (public RPC). */
export interface QaPoolItemSummary {
  tx_hash: string;
  bytecode_hash: string;
  deployer: string;
  allow_votes: number;
  reject_votes: number;
  age_secs: number;
  purpose_category?: string;
  asset_name?: string;
  asset_symbol?: string;
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

/** Subset of `boing_getNetworkInfo` used by the explorer UI. */
export interface BoingNetworkInfo {
  chain_id?: number | null;
  chain_name?: string | null;
  head_height: number;
  consensus?: {
    validator_count?: number;
    model?: string;
  };
  /** Discovery modes advertised with the same RPC snapshot as DEX list methods. */
  developer?: {
    dex_discovery_methods?: string[];
  } | null;
  end_user?: {
    chain_display_name?: string;
    explorer_url?: string | null;
    faucet_url?: string | null;
    canonical_native_cp_pool?: string | null;
    canonical_native_dex_factory?: string | null;
  };
  /** Native denomination switch (`base_units_from_height`: 0 on chains that were base units from genesis). */
  native_currency?: {
    symbol?: string;
    /** Unit of amounts returned *now*: 18 (base units) at/after the switch height, 0 before. */
    decimals?: number;
    base_unit_decimals?: number;
    base_units_per_boing?: string;
    base_units_from_height?: number;
    gas_price_base_units?: string;
  };
  /** Treasury account + live fee policy snapshot (same shape as `boing_getNetworkFeePolicy`). */
  treasury?: {
    account?: string;
    balance?: string;
    fee_policy?: BoingNetworkFeePolicy;
  };
  /** Public RPC limits (batch size, log range, rate limit). */
  rpc_surface?: BoingHealthRpcSurface & { tx_batch_max_calls?: number; tx_payload_batch?: boolean };
}

/**
 * Result of `boing_getNetworkFeePolicy`. Amounts are decimal strings in ledger units; BPS fields are
 * integers out of 10_000. `priority_tip` is paid on top of the network fee and split by `tip_*_bps`.
 */
export interface BoingNetworkFeePolicy {
  /** Share of the base fee: validators / treasury / burn (sum to 10_000). */
  fee_validators_bps: number;
  fee_treasury_bps: number;
  fee_burn_bps: number;
  /** Execution gas fee as BPS of the full historical schedule (100 = recommended micro fee, 0 = waived). */
  execution_gas_fee_bps: number;
  execution_gas_waived?: boolean;
  micro_fee_execution_gas_bps?: number;
  extra_fixed_fee: string;
  transfer_amount_bps: number;
  blob_base_fee_per_kib: string;
  blob_forever_pin_fee_per_kib: string;
  free_tx_min_balance: string;
  /** How an optional `priority_tip` is split (proposer / treasury / burn). */
  tip_proposer_bps: number;
  tip_treasury_bps: number;
  tip_burn_bps: number;
  optional_priority_tips?: boolean;
  treasury_account?: string;
  gas_price_base_units?: string;
  fee_formula?: string;
  fee_formula_base_units?: string;
  note?: string;
}

/** Result of `boing_getContractStorage`. */
export interface ContractStorageWord {
  value: string;
}

/** Embedded method catalog from `boing_getRpcMethodCatalog` (shape varies by node). */
/**
 * `method_catalog.protocol_specs`: stable protocol facts for signers and indexers. Additive-only upstream, so
 * the shape is intentionally loose: unknown sections are rendered generically.
 */
export interface RpcProtocolSpecs {
  version?: number;
  note?: string;
  [section: string]: unknown;
}

export interface RpcMethodCatalogResult {
  description?: string;
  protocol_specs?: RpcProtocolSpecs;
  methods?: Array<{
    name: string;
    summary?: string;
    params?: unknown;
    result?: unknown;
  }>;
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

/**
 * Normalize a Boing AccountId for links: exactly 32 bytes (64 hex), optional 0x.
 * Does not left-pad short hex (avoids mistaking truncated input for a valid account).
 */
export function normalizeAddress(addr: string): string {
  return normalizeHex64(addr);
}

/**
 * Default decimals for `formatBalance`. Native BOING ledger amounts carry their own unit (see
 * `native-unit.ts` and `Account.decimals`); pass it explicitly.
 */
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
