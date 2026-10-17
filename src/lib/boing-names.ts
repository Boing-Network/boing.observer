/**
 * `.boing` name registry helpers for the explorer (see boing.network docs/RPC-API-SPEC.md, "Name registry").
 * Lookups are cached briefly; a node without the registry answers "Method not found" and we treat it as "no name".
 */
import { getRpcBaseUrl, rpcCall } from "./rpc-client";
import type { NetworkId } from "./rpc-methods";

export const NAME_SUFFIX = ".boing";

export type NameStatus = "active" | "grace" | "expired";

export interface BoingNameRecord {
  name: string;
  display: string;
  owner: string;
  target: string;
  registered_at: number;
  expires_at: number;
  status: NameStatus;
}

export interface BoingNameRegistryInfo {
  enabled: boolean;
  active?: boolean;
  activation_height?: number;
  blocks_per_year?: number;
  grace_blocks?: number;
  commit_min_age?: number;
  commit_max_age?: number;
}

export interface BoingNameInfo {
  input: string;
  name?: string;
  display?: string;
  valid: boolean;
  error?: string;
  reserved?: boolean;
  available: boolean;
  status?: NameStatus | null;
  /** Ledger units (base units after the 18-decimals switch); use `rent_per_year_boing` for display. */
  rent_per_year?: string;
  /** Yearly rent in whole BOING (testnet-v0.1.17+ nodes). */
  rent_per_year_boing?: string;
  record?: BoingNameRecord;
  registry?: BoingNameRegistryInfo;
  head_height?: number;
}

export interface BoingReverseName {
  name: string;
  display: string;
  address: string;
  verified: boolean;
}

export type NameValidation = { ok: true; label: string } | { ok: false; error: string };

/** Trim, lowercase, drop `.boing`; 3-32 of a-z 0-9 '-', no edge/double hyphen, not address-like. */
export function normalizeBoingName(input: string): NameValidation {
  let s = (input ?? "").trim().toLowerCase();
  if (s.endsWith(NAME_SUFFIX)) s = s.slice(0, -NAME_SUFFIX.length);
  if (s.length < 3 || s.length > 32) return { ok: false, error: "Names are 3-32 characters" };
  if (!/^[a-z0-9-]+$/.test(s)) return { ok: false, error: "Names use only a-z, 0-9 and '-'" };
  if (s.startsWith("-") || s.endsWith("-") || s.includes("--")) {
    return { ok: false, error: "A name can't start or end with '-' or contain '--'" };
  }
  if (s.startsWith("0x") || /^[0-9]+$/.test(s) || (s.length >= 32 && /^[0-9a-f]+$/.test(s))) {
    return { ok: false, error: "A name can't look like an address or be only digits" };
  }
  return { ok: true, label: s };
}

/** Search input that should open a name page (not a height or a 64-hex id). */
export function looksLikeBoingName(input: string): boolean {
  const s = (input ?? "").trim();
  if (!s || /^\d+$/.test(s) || /^(0x)?[0-9a-fA-F]{64}$/.test(s)) return false;
  return normalizeBoingName(s).ok;
}

export function boingNameRentPerYear(label: string): number {
  const n = label.length;
  if (n <= 3) return 10;
  if (n === 4) return 5;
  if (n === 5) return 2;
  return 1;
}

export function nameHref(label: string, network: string): string {
  return `/name/${encodeURIComponent(label)}?network=${encodeURIComponent(network)}`;
}

/** Rough wall-clock estimate of `blocks` ahead (2 s blocks, when the chain is busy). */
export function blocksToHuman(blocks: number, blocksPerYear: number | undefined): string {
  if (!blocksPerYear || blocks <= 0) return "";
  const days = (blocks / blocksPerYear) * 365;
  if (days >= 365) return `~${(days / 365).toFixed(1)} years`;
  if (days >= 1) return `~${Math.floor(days)} days`;
  return "< 1 day";
}

const cache = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL_MS = 30_000;

function isMethodNotFound(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /method not found|not allowed|-32601/i.test(m);
}

function cached<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p as Promise<T>;
  const p = load().catch((e) => {
    cache.delete(key);
    if (isMethodNotFound(e)) return fallback;
    throw e;
  });
  cache.set(key, { at: Date.now(), p });
  return p;
}

function addr(a: string): string {
  return a.startsWith("0x") ? a.toLowerCase() : `0x${a.toLowerCase()}`;
}

export function fetchReverseName(network: NetworkId, address: string): Promise<BoingReverseName | null> {
  const base = getRpcBaseUrl(network);
  const a = addr(address);
  return cached(`${network}:rev:${a}`, () => rpcCall<BoingReverseName | null>(network, base, "boing_reverseName", [a]), null);
}

export function fetchResolveName(network: NetworkId, label: string): Promise<BoingNameRecord | null> {
  const base = getRpcBaseUrl(network);
  return cached(`${network}:res:${label}`, () => rpcCall<BoingNameRecord | null>(network, base, "boing_resolveName", [label]), null);
}

export function fetchNameInfo(network: NetworkId, label: string): Promise<BoingNameInfo | null> {
  const base = getRpcBaseUrl(network);
  return cached(`${network}:info:${label}`, () => rpcCall<BoingNameInfo | null>(network, base, "boing_getNameInfo", [label]), null);
}

export function fetchNamesOwnedBy(network: NetworkId, address: string): Promise<BoingNameRecord[]> {
  const base = getRpcBaseUrl(network);
  const a = addr(address);
  return cached(`${network}:owned:${a}`, () => rpcCall<BoingNameRecord[]>(network, base, "boing_namesOwnedBy", [a]), []);
}