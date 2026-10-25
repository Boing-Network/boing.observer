/**
 * Account Merkle proofs: `boing_getAccountProof` -> `{ proof, root, value_hash }` and
 * `boing_verifyAccountProof([proof, root])` -> `{ valid }` (node-side check of the proof and its root).
 *
 * Trust model: the node verifies its own proof, so `valid` alone only says the proof is internally consistent
 * and ends at `root`. Anchoring `root` to a block header's `state_root` (done here for the newest blocks) ties
 * it to chain history; comparing against a second, independent node is the trust-minimized check.
 */
import { BoingRpcCallError } from "./rpc-error";
import { rpcCall, getRpcBaseUrl } from "./rpc-client";
import { fetchBlockByHeight, fetchChainHeight } from "./rpc-methods";
import { normalizeHex64, toPrefixedHex64, type NetworkId } from "./rpc-types";

export interface AccountProofResult {
  proof: string;
  root: string;
  value_hash: string;
}

export interface AccountProofCheck {
  address: string;
  proofHex: string;
  proofBytes: number;
  root: string;
  valueHash: string;
  /** Result of `boing_verifyAccountProof`; `null` when the node lacks that method. */
  nodeVerified: boolean | null;
  headHeight: number;
  /** Height of the newest inspected block whose `state_root` equals `root`, or `null`. */
  matchedHeight: number | null;
  inspectedHeights: number[];
}

/** How many of the newest blocks to compare `root` against (proof is built from the head state, which can advance mid-check). */
export const ROOT_LOOKBACK_BLOCKS = 3;

function stripHex(s: string): string {
  return s.trim().replace(/^0x/i, "").toLowerCase();
}

/** Byte length of a hex string (odd lengths / non-hex return `null`). */
export function hexByteLength(hex: string): number | null {
  const h = stripHex(hex);
  return h.length > 0 && h.length % 2 === 0 && /^[0-9a-f]+$/.test(h) ? h.length / 2 : null;
}

/** Newest-first search for a header whose `state_root` equals `root`. */
export function findRootMatch(
  root: string,
  headers: ReadonlyArray<{ height: number; state_root?: unknown }>,
): number | null {
  const want = stripHex(root);
  if (!want) return null;
  for (const h of headers) {
    if (typeof h.state_root === "string" && stripHex(h.state_root) === want) return h.height;
  }
  return null;
}

/** `true` for JSON-RPC "method not found" (older node or filtered gateway). */
export function isMethodNotFound(err: unknown): boolean {
  return err instanceof BoingRpcCallError && (err.code === -32601 || /method not found|not allowed/i.test(err.message));
}

export function parseAccountProofResult(v: unknown): AccountProofResult | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.proof !== "string" || typeof o.root !== "string") return null;
  if (hexByteLength(o.proof) == null || hexByteLength(o.root) == null) return null;
  return { proof: o.proof, root: o.root, value_hash: typeof o.value_hash === "string" ? o.value_hash : "" };
}

export async function checkAccountProof(network: NetworkId, addressInput: string): Promise<AccountProofCheck> {
  const address = normalizeHex64(addressInput);
  if (!address) throw new Error("Enter a 32-byte account id (64 hex characters).");
  const base = getRpcBaseUrl(network);

  const raw = await rpcCall<unknown>(network, base, "boing_getAccountProof", [toPrefixedHex64(address)]);
  const proof = parseAccountProofResult(raw);
  if (!proof) throw new Error("The node returned an account proof in an unexpected shape.");

  let nodeVerified: boolean | null = null;
  try {
    const v = await rpcCall<{ valid?: boolean }>(network, base, "boing_verifyAccountProof", [proof.proof, proof.root]);
    nodeVerified = typeof v?.valid === "boolean" ? v.valid : null;
  } catch (e) {
    if (!isMethodNotFound(e)) throw e;
  }

  const headHeight = await fetchChainHeight(network);
  const headers: Array<{ height: number; state_root?: unknown }> = [];
  const inspectedHeights: number[] = [];
  let matchedHeight: number | null = null;
  for (let h = headHeight; h >= 0 && h > headHeight - ROOT_LOOKBACK_BLOCKS; h--) {
    const block = await fetchBlockByHeight(network, h, false, false);
    inspectedHeights.push(h);
    if (block) headers.push({ height: h, state_root: block.header.state_root });
    matchedHeight = findRootMatch(proof.root, headers);
    if (matchedHeight != null) break;
  }

  return {
    address,
    proofHex: proof.proof,
    proofBytes: hexByteLength(proof.proof) ?? 0,
    root: proof.root,
    valueHash: proof.value_hash,
    nodeVerified,
    headHeight,
    matchedHeight,
    inspectedHeights,
  };
}