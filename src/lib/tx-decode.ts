/**
 * Decode Boing VM contract-call calldata (and the receipt) into a human description: which tokens moved,
 * how much, between whom, through which pool / router.
 *
 * Pure and dependency-free (no EVM/ABI runtime): the calldata layout is the reference one used by every
 * canonical template (`contract-interfaces.ts`): word 0 = selector in the low byte, then one 32-byte word per
 * parameter; amounts are u128 big-endian in the low 16 bytes. Pool logs follow `docs/NATIVE-AMM-CALLDATA.md`.
 */

import { CONTRACT_INTERFACES, type ContractFunction } from "./contract-interfaces";

export type TokenMeta = { symbol: string | null; name: string | null; decimals: number | null };
export type PoolMeta = { tokenA: string; tokenB: string; feeBps: number | null };

/** What the server (or a test) knows about the addresses a transaction mentions. All keys are 64 lowercase hex. */
export type DecodeContext = {
  /** Interface id of the called contract (`contract-interfaces.ts`), when known. */
  interfaceId: string | null;
  tokens: Record<string, TokenMeta>;
  pools: Record<string, PoolMeta>;
  /** Human labels for well-known addresses (routers, canonical pools, vaults). */
  labels: Record<string, string>;
};

export const EMPTY_DECODE_CONTEXT: DecodeContext = { interfaceId: null, tokens: {}, pools: {}, labels: {} };

export type DecodedArg = {
  name: string;
  type: string;
  /** The raw 32-byte word (64 hex). */
  word: string;
  /** Unsigned integer value (decimal string) for numeric params; null for accounts / bytes32. */
  value: bigint | null;
  /** 64-hex account for `account` params, else null. */
  account: string | null;
};

export type DecodedCall = {
  interfaceId: string;
  /** Contract the call is addressed to (64 hex). */
  contract: string;
  fn: Pick<ContractFunction, "selector" | "name">;
  args: DecodedArg[];
  /** Router hops (custody router only). */
  hops?: Array<{ pool: string; direction: bigint; tokenIn: string }>;
  /** Pool call forwarded by a ledger router: the inner call. */
  inner?: DecodedCall;
};

const HEX64 = /^[0-9a-f]{64}$/;
const MAX_U128 = (BigInt(1) << BigInt(128)) - BigInt(1);
const ZERO = BigInt(0);
const ONE = BigInt(1);

export function calldataWords(calldata: unknown): string[] | null {
  if (typeof calldata !== "string") return null;
  const h = calldata.trim().replace(/^0x/i, "").toLowerCase();
  if (h.length === 0 || h.length % 64 !== 0 || !/^[0-9a-f]+$/.test(h)) return null;
  const out: string[] = [];
  for (let i = 0; i < h.length; i += 64) out.push(h.slice(i, i + 64));
  return out;
}

/** Word as u128 when the upper 16 bytes are zero, else null. */
export function wordU128(word: string): bigint | null {
  if (!HEX64.test(word) || !/^0{32}/.test(word)) return null;
  return BigInt(`0x${word}`);
}

function selectorOf(words: string[]): number | null {
  const w0 = words[0];
  if (!w0 || !/^0{62}/.test(w0)) return null;
  return parseInt(w0.slice(62), 16);
}

function argFrom(name: string, type: string, word: string): DecodedArg {
  const isAccount = type === "account";
  return {
    name,
    type,
    word,
    value: isAccount || type === "bytes32" ? null : wordU128(word),
    account: isAccount ? word : null,
  };
}

const POOL_FAMILIES = ["pool-custody", "pool-ledger"] as const;

function decodeWithFunctions(
  interfaceId: string,
  contract: string,
  words: string[],
  fns: ContractFunction[],
): DecodedCall | null {
  const sel = selectorOf(words);
  if (sel == null) return null;
  const fn = fns.find((f) => f.selector === sel && f.params.length + 1 === words.length && f.kind === "write");
  if (!fn) return null;
  return {
    interfaceId,
    contract,
    fn: { selector: fn.selector, name: fn.name },
    args: fn.params.map((p, i) => argFrom(p.name, p.type, words[i + 1]!)),
  };
}

/**
 * Decode calldata addressed to `contract`.
 *
 * `interfaceId` is the contract's interface when the server identified it. `isPool` says the address is a DEX pool
 * of unknown version: ledger pools (v1..v7) and custody pools (v8/v9) are told apart by (selector, word count),
 * which never collides.
 */
export function decodeContractCall(input: {
  contract: string;
  calldata: unknown;
  interfaceId: string | null;
  isPool?: boolean;
}): DecodedCall | null {
  const words = calldataWords(input.calldata);
  if (!words) return null;
  const contract = input.contract.replace(/^0x/i, "").toLowerCase();
  const sel = selectorOf(words);
  if (sel == null) return null;

  let candidates: string[] = [];
  if (input.interfaceId) candidates = [input.interfaceId];
  else if (input.isPool) candidates = [...POOL_FAMILIES];

  for (const id of candidates) {
    if (id === "custody-router") {
      const d = decodeCustodyRouter(contract, words);
      if (d) return d;
      continue;
    }
    if (id === "ledger-router") {
      const d = decodeLedgerRouter(contract, words);
      if (d) return d;
      continue;
    }
    const iface = CONTRACT_INTERFACES[id];
    if (!iface) continue;
    const d = decodeWithFunctions(id, contract, words, iface.functions);
    if (d) return d;
  }
  return null;
}

/** `sel | hops | amount_in | min_out | recipient | deadline | (pool, direction, token_in) x hops`. */
function decodeCustodyRouter(contract: string, words: string[]): DecodedCall | null {
  if (selectorOf(words) !== 0xf1 || words.length < 9) return null;
  const hopsN = wordU128(words[1]!);
  if (hopsN == null || hopsN < ONE || hopsN > BigInt(4)) return null;
  const n = Number(hopsN);
  if (words.length !== 6 + 3 * n) return null;
  const iface = CONTRACT_INTERFACES["custody-router"]!;
  const fn = iface.functions[0]!;
  const head = fn.params.map((p, i) => argFrom(p.name, p.type, words[i + 1]!));
  const hops: NonNullable<DecodedCall["hops"]> = [];
  for (let i = 0; i < n; i++) {
    const pool = words[6 + 3 * i]!;
    const dir = wordU128(words[7 + 3 * i]!);
    const tokenIn = words[8 + 3 * i]!;
    if (dir == null || (dir !== ZERO && dir !== ONE)) return null;
    hops.push({ pool, direction: dir, tokenIn });
  }
  return { interfaceId: "custody-router", contract, fn: { selector: 0xf1, name: "swap" }, args: head, hops };
}

/** `sel | pool | inner pool calldata`: the router forwards the inner call with Caller = router. */
function decodeLedgerRouter(contract: string, words: string[]): DecodedCall | null {
  const sel = selectorOf(words);
  if (sel == null || ![0xe0, 0xe1, 0xe2].includes(sel) || words.length < 3) return null;
  const pool = words[1]!;
  const innerWords = words.slice(2);
  const inner = decodeContractCall({ contract: pool, calldata: innerWords.join(""), interfaceId: null, isPool: true });
  if (!inner) return null;
  const name = sel === 0xe0 ? "forward_pool_call" : sel === 0xe1 ? "forward_pool_call_v2" : "forward_pool_call_v3";
  return {
    interfaceId: "ledger-router",
    contract,
    fn: { selector: sel, name },
    args: [argFrom("pool", "account", pool)],
    inner,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Receipt: return data and native AMM Log2 events
// ---------------------------------------------------------------------------------------------------------

export type AmmEvent =
  | { kind: "swap"; direction: bigint; amountIn: bigint; amountOut: bigint }
  | { kind: "addLiquidity"; amountA: bigint; amountB: bigint; lpMinted: bigint }
  | { kind: "removeLiquidity"; liquidity: bigint; amountA: bigint; amountB: bigint };

const LOG_LABELS: Record<string, AmmEvent["kind"]> = {
  BOING_NATIVEAMM_SWAP_V1: "swap",
  BOING_NATIVEAMM_ADDLP_V1: "addLiquidity",
  BOING_NATIVEAMM_RMLP_V1: "removeLiquidity",
};

function asciiLabel(topic: string): string | null {
  const h = topic.replace(/^0x/i, "").toLowerCase();
  if (!HEX64.test(h)) return null;
  let s = "";
  for (let i = 0; i < 64; i += 2) {
    const b = parseInt(h.slice(i, i + 2), 16);
    if (b === 0) {
      if (!/^0*$/.test(h.slice(i))) return null;
      break;
    }
    if (b < 0x20 || b > 0x7e) return null;
    s += String.fromCharCode(b);
  }
  return s;
}

/** Parse native AMM `Log2` rows (`topic0` label + caller + 3 u128 words) in log order; other logs are skipped. */
export function parseAmmEvents(logs: ReadonlyArray<{ topics?: string[]; data?: string }> | null | undefined): AmmEvent[] {
  const out: AmmEvent[] = [];
  for (const log of logs ?? []) {
    const t0 = log.topics?.[0];
    if (!t0) continue;
    const kind = LOG_LABELS[asciiLabel(t0) ?? ""];
    if (!kind) continue;
    const words = calldataWords(log.data ?? "");
    if (!words || words.length !== 3) continue;
    const [a, b, c] = words.map((w) => wordU128(w!));
    if (a == null || b == null || c == null) continue;
    if (kind === "swap") out.push({ kind, direction: a, amountIn: b, amountOut: c });
    else if (kind === "addLiquidity") out.push({ kind, amountA: a, amountB: b, lpMinted: c });
    else out.push({ kind, liquidity: a, amountA: b, amountB: c });
  }
  return out;
}

export type ReceiptLike = {
  success?: boolean;
  return_data?: string;
  logs?: Array<{ topics?: string[]; data?: string }>;
} | null;

// ---------------------------------------------------------------------------------------------------------
// Amount / token formatting
// ---------------------------------------------------------------------------------------------------------

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `raw` in token units: `decimals` fractional digits (null / 0 = whole units). Trailing zeros are trimmed. */
export function formatTokenAmount(raw: bigint, decimals: number | null | undefined): string {
  const d = typeof decimals === "number" && Number.isInteger(decimals) && decimals > 0 && decimals <= 36 ? decimals : 0;
  const s = raw.toString();
  if (d === 0) return group(s);
  const padded = s.padStart(d + 1, "0");
  const int = padded.slice(0, padded.length - d);
  const frac = padded.slice(padded.length - d).replace(/0+$/, "");
  return frac ? `${group(int)}.${frac}` : group(int);
}

export function shortId(id: string): string {
  return id.length > 18 ? `0x${id.slice(0, 6)}…${id.slice(-4)}` : `0x${id}`;
}

export function tokenSymbol(id: string, ctx: DecodeContext): string {
  const m = ctx.tokens[id];
  return m?.symbol?.trim() || m?.name?.trim() || ctx.labels[id] || `token ${shortId(id)}`;
}

// ---------------------------------------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------------------------------------

export type Segment =
  | { t: "text"; text: string }
  | { t: "amount"; text: string; title?: string }
  | { t: "token"; id: string; text: string }
  | { t: "account"; id: string; text: string; role?: "contract" | "account" };

export type DetailRow = { label: string; value: Segment[] };

export type TxDescription = {
  kind: "approve" | "transfer" | "transfer_from" | "swap" | "add_liquidity" | "remove_liquidity" | "mint" | "call";
  /** Short action label, e.g. "Swap". */
  title: string;
  /** One sentence for lists and the top of the detail page. */
  headline: Segment[];
  rows: DetailRow[];
  /** true when the receipt says the call reverted. */
  failed: boolean;
};

const t = (text: string): Segment => ({ t: "text", text });
const tok = (id: string, ctx: DecodeContext): Segment => ({ t: "token", id, text: tokenSymbol(id, ctx) });
const acct = (id: string, ctx: DecodeContext, role: "contract" | "account" = "account"): Segment => ({
  t: "account",
  id,
  text: ctx.labels[id] ?? shortId(id),
  role,
});
/** Address with no registry label (used where a label would repeat the surrounding text, e.g. pool rows). */
const bare = (id: string, role: "contract" | "account" = "contract"): Segment => ({ t: "account", id, text: shortId(id), role });
const amt = (raw: bigint, token: string | null, ctx: DecodeContext): Segment => {
  const m = token ? ctx.tokens[token] : undefined;
  return { t: "amount", text: formatTokenAmount(raw, m?.decimals ?? null), title: `${raw.toString()} raw units` };
};
const amountTok = (raw: bigint, token: string, ctx: DecodeContext): Segment[] => [amt(raw, token, ctx), t(" "), tok(token, ctx)];

export function segmentsToText(segs: Segment[]): string {
  return segs.map((s) => s.text).join("");
}

function joinSegs(parts: Segment[][], sep: string): Segment[] {
  const out: Segment[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(t(sep));
    out.push(...p);
  });
  return out;
}

function argU(call: DecodedCall, name: string): bigint {
  return call.args.find((a) => a.name === name)?.value ?? ZERO;
}
function argAcct(call: DecodedCall, name: string): string | null {
  return call.args.find((a) => a.name === name)?.account ?? null;
}

function poolTokens(pool: string, ctx: DecodeContext): { a: string; b: string } | null {
  const p = ctx.pools[pool];
  return p ? { a: p.tokenA, b: p.tokenB } : null;
}

function feeRow(feeBps: number | null, amountIn: bigint | null, tokenIn: string | null, ctx: DecodeContext): DetailRow | null {
  if (feeBps == null) return null;
  const pct = `${(feeBps / 100).toFixed(2)}%`;
  if (amountIn == null || tokenIn == null) return { label: "Pool fee", value: [t(pct)] };
  const afterFee = (amountIn * BigInt(10000 - feeBps)) / BigInt(10000);
  const fee = amountIn - afterFee;
  return { label: "Pool fee", value: [t(`${pct} of the input (≈ `), ...amountTok(fee, tokenIn, ctx), t(")")] };
}

function rateSegment(inRaw: bigint, outRaw: bigint, tIn: string, tOut: string, ctx: DecodeContext): Segment[] | null {
  if (inRaw === ZERO || outRaw === ZERO) return null;
  const dIn = ctx.tokens[tIn]?.decimals ?? 0;
  const dOut = ctx.tokens[tOut]?.decimals ?? 0;
  const scaled = (Number(outRaw) / 10 ** dOut) / (Number(inRaw) / 10 ** dIn);
  if (!Number.isFinite(scaled) || scaled <= 0) return null;
  return [t(`1 ${tokenSymbol(tIn, ctx)} ≈ ${Number(scaled.toPrecision(6))} ${tokenSymbol(tOut, ctx)}`)];
}

type Hop = { pool: string; direction: bigint; tokenIn: string | null; tokenOut: string | null };

function describeSwap(
  call: DecodedCall,
  sender: string,
  receipt: ReceiptLike,
  ctx: DecodeContext,
  viaRouter: DecodedCall | null,
): TxDescription {
  const failed = receipt?.success === false;
  const ok = receipt?.success === true;
  const events = ok ? parseAmmEvents(receipt?.logs).filter((e): e is Extract<AmmEvent, { kind: "swap" }> => e.kind === "swap") : [];

  let hops: Hop[];
  let amountIn: bigint;
  let minOut: bigint;
  let recipient: string | null;
  let deadline: bigint;
  const customFamily = call.interfaceId === "custody-router" || call.interfaceId === "pool-custody";

  if (call.interfaceId === "custody-router") {
    amountIn = argU(call, "amount_in");
    minOut = argU(call, "min_out");
    recipient = argAcct(call, "recipient");
    deadline = argU(call, "deadline");
    hops = (call.hops ?? []).map((h) => {
      const tk = poolTokens(h.pool, ctx);
      const tokenIn = h.tokenIn;
      let tokenOut: string | null = null;
      if (tk) tokenOut = tokenIn === tk.a ? tk.b : tokenIn === tk.b ? tk.a : null;
      return { pool: h.pool, direction: h.direction, tokenIn, tokenOut };
    });
  } else {
    amountIn = argU(call, "amount_in");
    minOut = argU(call, "min_out");
    recipient = argAcct(call, "recipient") ?? sender;
    deadline = argU(call, "deadline");
    const tk = poolTokens(call.contract, ctx);
    const dir = argU(call, "direction");
    hops = [
      {
        pool: call.contract,
        direction: dir,
        tokenIn: tk ? (dir === ZERO ? tk.a : tk.b) : null,
        tokenOut: tk ? (dir === ZERO ? tk.b : tk.a) : null,
      },
    ];
  }

  const first = hops[0];
  const last = hops[hops.length - 1];
  const tokenIn = first?.tokenIn ?? null;
  const tokenOut = last?.tokenOut ?? null;

  // Actual output: the last hop's log, else the call's return word (custody pools v9 / router return amount_out).
  let amountOut: bigint | null = null;
  if (ok) {
    const lastEv = events[events.length - 1];
    if (lastEv) amountOut = lastEv.amountOut;
    else if (receipt?.return_data) {
      const w = calldataWords(receipt.return_data);
      const v = w && w.length >= 1 ? wordU128(w[w.length - 1]!) : null;
      if (v != null) amountOut = v;
    }
  }
  const actualIn = ok && events[0] ? events[0].amountIn : amountIn;

  const inSegs = tokenIn ? amountTok(amountIn, tokenIn, ctx) : [amt(amountIn, null, ctx), t(" (raw units)")];
  const outSegs = (raw: bigint) => (tokenOut ? amountTok(raw, tokenOut, ctx) : [amt(raw, null, ctx), t(" (raw units)")]);

  let headline: Segment[];
  if (ok && amountOut != null) headline = [t("Swapped "), ...inSegs, t(" for "), ...outSegs(amountOut)];
  else if (failed) headline = [t("Attempted to swap "), ...inSegs, t(" for at least "), ...outSegs(minOut), t(" (reverted)")];
  else headline = [t("Swap "), ...inSegs, t(" for at least "), ...outSegs(minOut)];
  if (recipient && recipient !== sender) headline.push(t(" → "), acct(recipient, ctx));

  const rows: DetailRow[] = [];
  rows.push({ label: "Sold", value: inSegs });
  if (ok && amountOut != null) rows.push({ label: "Received", value: outSegs(amountOut) });
  rows.push({ label: ok ? "Minimum accepted" : "Minimum out", value: outSegs(minOut) });
  if (ok && amountOut != null && tokenIn && tokenOut) {
    const r = rateSegment(actualIn, amountOut, tokenIn, tokenOut, ctx);
    if (r) rows.push({ label: "Effective rate", value: r });
  }
  const route: Segment[][] = hops.map((h) => {
    const tk = poolTokens(h.pool, ctx);
    const pair = tk ? [tok(tk.a, ctx), t(" / "), tok(tk.b, ctx), t(" pool ")] : [t("pool ")];
    return [...pair, bare(h.pool)];
  });
  rows.push({ label: hops.length > 1 ? `Route (${hops.length} hops)` : "Pool", value: joinSegs(route, " → ") });
  const router = viaRouter ?? (call.interfaceId === "custody-router" ? call : null);
  if (router) rows.push({ label: "Router", value: [acct(router.contract, ctx, "contract")] });
  if (customFamily && hops.length === 1 && first) {
    const fr = feeRow(ctx.pools[first.pool]?.feeBps ?? null, actualIn, tokenIn, ctx);
    if (fr) rows.push(fr);
  } else if (hops.length > 1) {
    const fees = hops.map((h) => ctx.pools[h.pool]?.feeBps);
    if (fees.every((f) => f != null)) rows.push({ label: "Pool fees", value: [t(fees.map((f) => `${(f! / 100).toFixed(2)}%`).join(" + "))] });
  }
  rows.push({ label: "From (signer)", value: [acct(sender, ctx)] });
  rows.push({ label: "To (recipient)", value: [recipient ? acct(recipient, ctx) : t("—")] });
  if (deadline > ZERO) rows.push({ label: "Deadline", value: [t(`block ${deadline.toString()}`)] });

  return { kind: "swap", title: "Swap", headline, rows, failed };
}

function describeLiquidity(call: DecodedCall, sender: string, receipt: ReceiptLike, ctx: DecodeContext): TxDescription {
  const failed = receipt?.success === false;
  const ok = receipt?.success === true;
  const pool = call.contract;
  const tk = poolTokens(pool, ctx);
  const ev = ok ? parseAmmEvents(receipt?.logs).find((e) => e.kind === (call.fn.name === "add_liquidity" ? "addLiquidity" : "removeLiquidity")) : undefined;
  const pair: Segment[] = tk ? [tok(tk.a, ctx), t(" / "), tok(tk.b, ctx)] : [t("the pool")];
  const side = (raw: bigint, which: "a" | "b"): Segment[] => (tk ? amountTok(raw, tk[which], ctx) : [amt(raw, null, ctx), t(" (raw units)")]);
  const rows: DetailRow[] = [{ label: "Pool", value: [...pair, t(" pool "), bare(pool)] }];
  let headline: Segment[];
  if (call.fn.name === "add_liquidity") {
    const a = ev?.kind === "addLiquidity" ? ev.amountA : argU(call, "amount_a");
    const b = ev?.kind === "addLiquidity" ? ev.amountB : argU(call, "amount_b");
    const verb = failed ? "Attempted to add liquidity: " : ok ? "Added liquidity: " : "Add liquidity: ";
    headline = [t(verb), ...side(a, "a"), t(" + "), ...side(b, "b")];
    rows.push({ label: "Deposited A", value: side(a, "a") }, { label: "Deposited B", value: side(b, "b") });
    if (ev?.kind === "addLiquidity") {
      headline.push(t(`, minted ${formatTokenAmount(ev.lpMinted, null)} LP`));
      rows.push({ label: "LP minted", value: [amt(ev.lpMinted, null, ctx)] });
    } else rows.push({ label: "Minimum LP", value: [amt(argU(call, "min_liquidity"), null, ctx)] });
    rows.push({ label: "Provider (signer)", value: [acct(sender, ctx)] });
    return { kind: "add_liquidity", title: "Add liquidity", headline, rows, failed };
  }
  const burned = ev?.kind === "removeLiquidity" ? ev.liquidity : argU(call, "liquidity");
  const a = ev?.kind === "removeLiquidity" ? ev.amountA : null;
  const b = ev?.kind === "removeLiquidity" ? ev.amountB : null;
  headline = [t(failed ? "Attempted to remove liquidity: burn " : ok ? "Removed liquidity: burned " : "Remove liquidity: burn "), amt(burned, null, ctx), t(" LP")];
  if (a != null && b != null) headline.push(t(" for "), ...side(a, "a"), t(" + "), ...side(b, "b"));
  rows.push({ label: "LP burned", value: [amt(burned, null, ctx)] });
  if (a != null && b != null) rows.push({ label: "Received A", value: side(a, "a") }, { label: "Received B", value: side(b, "b") });
  else rows.push({ label: "Minimum A", value: side(argU(call, "min_a"), "a") }, { label: "Minimum B", value: side(argU(call, "min_b"), "b") });
  rows.push({ label: "Provider (signer)", value: [acct(sender, ctx)] });
  const ra = argAcct(call, "recipient_a");
  const rb = argAcct(call, "recipient_b");
  if (ra) rows.push({ label: "Recipient A", value: [acct(ra, ctx)] });
  if (rb) rows.push({ label: "Recipient B", value: [acct(rb, ctx)] });
  return { kind: "remove_liquidity", title: "Remove liquidity", headline, rows, failed };
}

function describeToken(call: DecodedCall, sender: string, receipt: ReceiptLike, ctx: DecodeContext): TxDescription | null {
  const token = call.contract;
  const failed = receipt?.success === false;
  const ok = receipt?.success === true;
  const tokRow: DetailRow = { label: "Token", value: [tok(token, ctx), t(" "), bare(token)] };
  const amount = argU(call, "amount");
  const unlimited = amount === MAX_U128;
  switch (call.fn.name) {
    case "approve": {
      const spender = argAcct(call, "spender")!;
      const amountSegs = unlimited ? [t("unlimited "), tok(token, ctx)] : amountTok(amount, token, ctx);
      const headline = [t(failed ? "Attempted to approve " : ok ? "Approved " : "Approve "), acct(spender, ctx), t(" to spend "), ...amountSegs];
      return {
        kind: "approve",
        title: "Token approval",
        headline,
        rows: [
          tokRow,
          { label: "Allowance", value: amountSegs },
          { label: "Owner (signer)", value: [acct(sender, ctx)] },
          { label: "Spender", value: [acct(spender, ctx)] },
        ],
        failed,
      };
    }
    case "transfer": {
      const to = argAcct(call, "to")!;
      const headline = [t(failed ? "Attempted to send " : ok ? "Sent " : "Send "), ...amountTok(amount, token, ctx), t(" to "), acct(to, ctx)];
      return {
        kind: "transfer",
        title: "Token transfer",
        headline,
        rows: [tokRow, { label: "Amount", value: amountTok(amount, token, ctx) }, { label: "From (signer)", value: [acct(sender, ctx)] }, { label: "To (recipient)", value: [acct(to, ctx)] }],
        failed,
      };
    }
    case "transfer_from": {
      const from = argAcct(call, "from")!;
      const to = argAcct(call, "to")!;
      const headline = [t(failed ? "Attempted to move " : ok ? "Moved " : "Move "), ...amountTok(amount, token, ctx), t(" from "), acct(from, ctx), t(" to "), acct(to, ctx)];
      return {
        kind: "transfer_from",
        title: "Token transfer (spender)",
        headline,
        rows: [tokRow, { label: "Amount", value: amountTok(amount, token, ctx) }, { label: "From (owner)", value: [acct(from, ctx)] }, { label: "To (recipient)", value: [acct(to, ctx)] }, { label: "Spender (signer)", value: [acct(sender, ctx)] }],
        failed,
      };
    }
    case "mint_first": {
      const to = argAcct(call, "to")!;
      const headline = [t(failed ? "Attempted initial mint of " : ok ? "Minted initial supply of " : "Mint initial supply of "), ...amountTok(amount, token, ctx), t(" to "), acct(to, ctx)];
      return { kind: "mint", title: "Initial mint", headline, rows: [tokRow, { label: "Amount", value: amountTok(amount, token, ctx) }, { label: "Minted to", value: [acct(to, ctx)] }, { label: "Admin (signer)", value: [acct(sender, ctx)] }], failed };
    }
    default:
      return null;
  }
}

function describeGeneric(call: DecodedCall, sender: string, receipt: ReceiptLike, ctx: DecodeContext): TxDescription {
  const failed = receipt?.success === false;
  const rows: DetailRow[] = [
    { label: "Contract", value: [acct(call.contract, ctx, "contract")] },
    { label: "Function", value: [t(`${call.fn.name} (selector 0x${call.fn.selector.toString(16).padStart(2, "0")})`)] },
  ];
  for (const a of call.args) {
    if (a.account) rows.push({ label: a.name, value: [acct(a.account, ctx)] });
    else if (a.value != null) rows.push({ label: a.name, value: [amt(a.value, null, ctx)] });
  }
  rows.push({ label: "Signer", value: [acct(sender, ctx)] });
  return {
    kind: "call",
    title: call.fn.name,
    headline: [t(failed ? `Attempted ${call.fn.name} on ` : `Called ${call.fn.name} on `), acct(call.contract, ctx, "contract")],
    rows,
    failed,
  };
}

const FUNGIBLE_IFACES = new Set(["fungible-v1", "fungible-v2", "fungible-secured", "lp-share-token"]);

/** Turn a decoded call (+ receipt) into a headline and detail rows. Always returns something for a decoded call. */
export function describeDecodedCall(
  call: DecodedCall,
  opts: { sender: string; receipt?: ReceiptLike; ctx: DecodeContext },
): TxDescription {
  const { sender, ctx } = opts;
  const receipt = opts.receipt ?? null;
  const effective = call.inner ?? call;
  const viaRouter = call.inner ? call : null;

  if (call.interfaceId === "custody-router") return describeSwap(call, sender, receipt, ctx, null);
  if (effective.interfaceId.startsWith("pool-")) {
    if (effective.fn.name === "swap" || effective.fn.name === "swap_to") return describeSwap(effective, sender, receipt, ctx, viaRouter);
    if (effective.fn.name === "add_liquidity" || effective.fn.name === "remove_liquidity" || effective.fn.name === "remove_liquidity_to") {
      return describeLiquidity(effective, sender, receipt, ctx);
    }
  }
  if (FUNGIBLE_IFACES.has(call.interfaceId)) {
    const d = describeToken(call, sender, receipt, ctx);
    if (d) return d;
  }
  return describeGeneric(call, sender, receipt, ctx);
}

/** 64-hex ids worth labelling for a call: every calldata word that is a full-width value (not a small integer). */
export function referencedIds(calldata: unknown, accessList?: { read?: string[]; write?: string[] } | null): string[] {
  const out = new Set<string>();
  for (const w of calldataWords(calldata) ?? []) {
    if (!/^0{32}/.test(w) && !/^0+$/.test(w)) out.add(w);
  }
  for (const list of [accessList?.read, accessList?.write]) {
    for (const a of list ?? []) {
      const h = String(a).replace(/^0x/i, "").toLowerCase();
      if (HEX64.test(h)) out.add(h);
    }
  }
  return [...out];
}
