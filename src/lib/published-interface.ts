/**
 * Published contract interfaces (on-chain interface registry, boing.network `docs/INTERFACE-REGISTRY.md`).
 *
 * A record counts as "Published by deployer" only when:
 *  1. the registry claimer is provably the contract's deployer (deploy tx found in history, or the address is
 *     BLAKE3(claimer || nonce_le) for some nonce below the claimer's current nonce), and
 *  2. BLAKE3 of the bytes served at the recorded URI equals the recorded hash.
 */
import { blake3 } from "@noble/hashes/blake3";
import type { AbiParamType, ContractFunction } from "./contract-interfaces";

type Rpc = <T>(method: string, params: unknown[]) => Promise<T>;

/** Public testnet interface registry (CREATE2 from the canonical DEX deployer). */
export const TESTNET_INTERFACE_REGISTRY = "bd7373b6a3830768b2cea3768bedc737b43d1f981123c83e7f0d75ebb310fb6c";
export const INTERFACE_REGISTRY_MAX_URI_BYTES = 192;
const MAX_JSON_BYTES = 128 * 1024;
const MAX_NONCE_SCAN = 200_000;

const h64 = (h: unknown) => (typeof h === "string" ? h.replace(/^0x/i, "").toLowerCase() : "");

function asciiWord(s: string): Uint8Array {
  const u = new Uint8Array(32);
  u.set(new TextEncoder().encode(s));
  return u;
}
const CLAIMER_XOR = asciiWord("BOING_IFACE_CLAIMER_V1");
const FIELD_XOR = asciiWord("BOING_IFACE_FIELD_V1");

/** Built-in hosting ("Host on Boing"): interface blob store (boing.network interface_blob_store). */
export const TESTNET_INTERFACE_BLOB_STORE = "a524837577e67228bf676257e861d29e510a3eddd1a4dbd607f613bbcd37904d";
export const IFACE_BLOB_URI_PREFIX = "boing://iface-blob/";
const BLOB_TAG = asciiWord("BOING_IFACE_BLOB_V1");
const BLOB_MAX_STORED_BYTES = 24 * 1024;

export function hexToBytes(h: string): Uint8Array {
  const s = h64(h);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function xorKey(address64: string, mask: Uint8Array): string {
  const a = hexToBytes(address64);
  return bytesToHex(a.map((x, i) => x ^ mask[i]!));
}
export const claimerKey = (address64: string) => xorKey(address64, CLAIMER_XOR);
export function fieldKey(address64: string, field: number): string {
  const m = FIELD_XOR.slice();
  m[31] = field;
  return xorKey(address64, m);
}

/** Storage key of word `index` of blob `id` by `writer`: writer ^ TAG ^ (id << 32) ^ index. */
export function blobKey(writer64: string, id: bigint, index: number): string {
  const k = hexToBytes(writer64).map((x, i) => x ^ BLOB_TAG[i]!);
  let v = BigInt.asUintN(64, id);
  for (let i = 27; i >= 20; i--) {
    k[i] = k[i]! ^ Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  let x = index >>> 0;
  for (let i = 31; i >= 28; i--) {
    k[i] = k[i]! ^ (x & 0xff);
    x >>>= 8;
  }
  return bytesToHex(k);
}

export function parseBlobUri(uri: string): { writer: string; id: bigint } | null {
  if (!uri.startsWith(IFACE_BLOB_URI_PREFIX)) return null;
  const m = /^0x([0-9a-fA-F]{64})\/([0-9a-fA-F]{16})$/.exec(uri.slice(IFACE_BLOB_URI_PREFIX.length));
  return m ? { writer: m[1]!.toLowerCase(), id: BigInt(`0x${m[2]}`) } : null;
}

async function inflateRaw(b: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("deflate-raw" as CompressionFormat);
      const w = ds.writable.getWriter();
      w.write(b as unknown as BufferSource).then(() => w.close()).catch(() => undefined);
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } catch {
      /* fall through to node:zlib */
    }
  }
  const zlib = await import("node:zlib");
  return new Uint8Array(zlib.inflateRawSync(b, { maxOutputLength: MAX_JSON_BYTES }));
}

/** Read a boing://iface-blob/ URI from chain storage and return the exact JSON bytes. */
export async function readInterfaceBlob(rpc: Rpc, uri: string, store64: string = TESTNET_INTERFACE_BLOB_STORE): Promise<Uint8Array> {
  const p = parseBlobUri(uri);
  if (!p) throw new Error("bad boing:// URI");
  const word = async (i: number) =>
    h64((await rpc<{ value?: string } | null>("boing_getContractStorage", [`0x${store64}`, `0x${blobKey(p.writer, p.id, i)}`]))?.value ?? "").padStart(64, "0");
  const header = hexToBytes(await word(0));
  if (new TextDecoder().decode(header.slice(0, 4)) !== "BIF1") throw new Error("blob not found");
  const len = Number(BigInt(`0x${bytesToHex(header.slice(24))}`));
  if (len <= 0 || len > BLOB_MAX_STORED_BYTES) throw new Error("bad blob length");
  const n = Math.ceil(len / 32);
  const words: string[] = [];
  for (let i = 0; i < n; i += 16) {
    words.push(...(await Promise.all(Array.from({ length: Math.min(16, n - i) }, (_, j) => word(i + j + 1)))));
  }
  const stored = hexToBytes(words.join("")).slice(0, len);
  if (header[4] === 0) return stored;
  if (header[4] === 1) return inflateRaw(stored);
  throw new Error(`unknown blob encoding ${header[4]}`);
}

export type RegistryRecord = { claimer: string; publisher: string; interfaceHash: string; uri: string };

export async function readRegistryRecord(rpc: Rpc, registry64: string, address64: string): Promise<RegistryRecord | null> {
  const read = async (key: string) => {
    const r = await rpc<{ value?: string }>("boing_getContractStorage", [`0x${registry64}`, `0x${key}`]);
    return h64(r?.value).padStart(64, "0");
  };
  const zero = "0".repeat(64);
  const hash = await read(fieldKey(address64, 0));
  if (hash === zero) return null;
  const [claimer, publisher, lenW] = await Promise.all([read(claimerKey(address64)), read(fieldKey(address64, 8)), read(fieldKey(address64, 1))]);
  const len = Math.min(parseInt(lenW.slice(48), 16) || 0, INTERFACE_REGISTRY_MAX_URI_BYTES);
  const words = await Promise.all(Array.from({ length: Math.ceil(len / 32) }, (_, i) => read(fieldKey(address64, 2 + i))));
  const uri = new TextDecoder().decode(hexToBytes(words.join("")).slice(0, len));
  return { claimer, publisher, interfaceHash: hash, uri };
}

/** `BLAKE3(sender || nonce_le)` (nonce-derived deploy address). */
export function nonceDerivedAddress(sender64: string, nonce: number): string {
  const buf = new Uint8Array(40);
  buf.set(hexToBytes(sender64), 0);
  // nonce_le (u64); nonces stay far below 2^53.
  let n = nonce;
  for (let i = 0; i < 8; i++) {
    buf[32 + i] = n % 256;
    n = Math.floor(n / 256);
  }
  return bytesToHex(blake3(buf));
}

/** True when `address64` is a nonce-derived deploy of `sender64` at any nonce below its current nonce. */
export async function isNonceDeployOf(rpc: Rpc, sender64: string, address64: string): Promise<boolean> {
  let nonce = 0;
  try {
    const acc = await rpc<{ nonce?: number | string } | null>("boing_getAccount", [`0x${sender64}`]);
    nonce = Number(acc?.nonce ?? 0);
  } catch {
    return false;
  }
  const target = h64(address64);
  for (let i = 0; i < Math.min(nonce, MAX_NONCE_SCAN); i++) {
    if (nonceDerivedAddress(sender64, i) === target) return true;
  }
  return false;
}

const PARAM_TYPES = new Set<AbiParamType>(["account", "u128", "u64", "bytes32", "bool", "u8"]);

export type PublishedDoc = { name: string | null; summary: string | null; functions: ContractFunction[] };

/** Validate a fetched interface JSON into observer functions; throws on bad shape. */
export function parsePublishedDoc(text: string): PublishedDoc {
  const v = JSON.parse(text) as Record<string, unknown>;
  if (!Array.isArray(v.functions)) throw new Error("missing functions array");
  const functions: ContractFunction[] = v.functions.map((f: Record<string, unknown>, i: number) => {
    const selector = Number(f.selector);
    if (!Number.isInteger(selector) || selector < 0 || selector > 255) throw new Error(`functions[${i}].selector`);
    if (typeof f.name !== "string" || !f.name) throw new Error(`functions[${i}].name`);
    const params = (Array.isArray(f.params) ? f.params : []).map((p: Record<string, unknown>, j: number) => {
      const type = String(p.type) as AbiParamType;
      if (!PARAM_TYPES.has(type)) throw new Error(`functions[${i}].params[${j}].type`);
      return { name: String(p.name ?? `arg${j}`), type, ...(typeof p.note === "string" ? { note: p.note } : {}) };
    });
    return {
      selector,
      name: f.name,
      params,
      kind: f.kind === "read" ? "read" : "write",
      description: typeof f.description === "string" ? f.description : "",
      access: typeof f.access === "string" ? f.access : "",
      ...(typeof f.returns === "string" ? { returns: f.returns } : {}),
    } as ContractFunction;
  });
  return {
    name: typeof v.name === "string" ? v.name : null,
    summary: typeof v.summary === "string" ? v.summary : null,
    functions,
  };
}

export type PublishedInterface = {
  registry: string;
  claimer: string;
  publisher: string;
  interfaceHash: string;
  uri: string;
  /** All checks passed: show "Published by deployer" and use these names. */
  verified: boolean;
  deployerVerified: boolean;
  hashVerified: boolean;
  /** "boing" when the file is stored on-chain in the interface blob store (built-in hosting). */
  hosting?: "boing" | "https";
  problem?: string;
  doc?: PublishedDoc;
};

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; bytes: Uint8Array }>;

const defaultFetcher: Fetcher = async (url) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    const buf = new Uint8Array(await r.arrayBuffer());
    return { ok: r.ok, status: r.status, bytes: buf };
  } finally {
    clearTimeout(t);
  }
};

export async function resolvePublishedInterface(
  rpc: Rpc,
  address64: string,
  opts: { registry64?: string; blobStore64?: string; knownDeployer?: string | null; fetcher?: Fetcher } = {},
): Promise<PublishedInterface | null> {
  const registry = h64(opts.registry64 ?? TESTNET_INTERFACE_REGISTRY);
  const rec = await readRegistryRecord(rpc, registry, h64(address64));
  if (!rec) return null;
  const base = { registry, ...rec };
  const known = h64(opts.knownDeployer ?? "");
  const deployerVerified = (known !== "" && known === rec.claimer) || (await isNonceDeployOf(rpc, rec.claimer, address64));
  if (!deployerVerified) {
    return { ...base, verified: false, deployerVerified, hashVerified: false, problem: "Registry claimer is not the contract's deployer; ignored." };
  }
  const onChain = rec.uri.startsWith(IFACE_BLOB_URI_PREFIX);
  if (!onChain && !/^https:\/\//i.test(rec.uri)) {
    return { ...base, verified: false, deployerVerified, hashVerified: false, problem: "Interface URI is not https or boing://iface-blob/; not fetched." };
  }
  const hosting = onChain ? ("boing" as const) : ("https" as const);
  let bytes: Uint8Array;
  try {
    if (onChain) {
      bytes = await readInterfaceBlob(rpc, rec.uri, h64(opts.blobStore64 ?? TESTNET_INTERFACE_BLOB_STORE));
    } else {
      const r = await (opts.fetcher ?? defaultFetcher)(rec.uri);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      bytes = r.bytes;
    }
    if (bytes.length > MAX_JSON_BYTES) throw new Error("too large");
  } catch (e) {
    return { ...base, hosting, verified: false, deployerVerified, hashVerified: false, problem: `Published interface could not be fetched (${(e as Error).message}).` };
  }
  const hashVerified = bytesToHex(blake3(bytes)) === rec.interfaceHash;
  if (!hashVerified) {
    return { ...base, hosting, verified: false, deployerVerified, hashVerified, problem: "Published interface hash does not match the file at its URI; ignored." };
  }
  try {
    const doc = parsePublishedDoc(new TextDecoder().decode(bytes));
    return { ...base, hosting, verified: true, deployerVerified, hashVerified, doc };
  } catch (e) {
    return { ...base, hosting, verified: false, deployerVerified, hashVerified, problem: `Published interface JSON is invalid (${(e as Error).message}).` };
  }
}