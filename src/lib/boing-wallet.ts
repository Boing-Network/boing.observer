/**
 * Thin Boing Express helpers for the explorer (no boing-sdk overlay).
 * Mirrors Express `injectedWallet.ts` / docs/WALLET_CONNECTION_AND_API.md.
 */

import {
  BOING_MAINNET_CHAIN_ID_HEX,
  BOING_TESTNET_CHAIN_ID_HEX,
} from "./chain-ids";
import { isAccountHex, normalizeVoterHex } from "./qa-reviewer-auth";
import type { NetworkId } from "./rpc-types";
import { createBoingWebWalletProvider } from "./boing-web-wallet";

export type QaVoteKind = "allow" | "reject" | "abstain";

export type BoingInjectedProvider = {
  request: (args: { method: string; params?: unknown[] | unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isBoing?: boolean;
  isBoingExpress?: boolean;
};

export function chainIdHexForNetwork(network: NetworkId): string {
  return network === "mainnet" ? BOING_MAINNET_CHAIN_ID_HEX : BOING_TESTNET_CHAIN_ID_HEX;
}

export function getInjectedBoingProvider(
  globalObj: typeof globalThis = globalThis
): BoingInjectedProvider | null {
  const g = globalObj as typeof globalThis & { boing?: unknown };
  const raw = g.boing;
  if (raw != null && typeof raw === "object" && typeof (raw as BoingInjectedProvider).request === "function") {
    return raw as BoingInjectedProvider;
  }
  return null;
}

const webProviders = new Map<string, BoingInjectedProvider>();

/**
 * Extension provider when injected (primary); otherwise the boing.express web wallet, which opens a
 * boing.express popup where the user approves each connect / signature (docs/WEB-SIGNING-FLOW.md).
 * Call from a click handler so the popup is not blocked.
 */
export function getBoingProviderWithWebFallback(
  network: NetworkId,
  globalObj: typeof globalThis = globalThis
): BoingInjectedProvider | null {
  const injected = getInjectedBoingProvider(globalObj);
  if (injected) return injected;
  if (typeof window === "undefined") return null;
  const chainId = chainIdHexForNetwork(network).toLowerCase();
  let p = webProviders.get(chainId);
  if (!p) {
    p = createBoingWebWalletProvider({ chainId, mode: "popup" }) as BoingInjectedProvider;
    webProviders.set(chainId, p);
  }
  return p;
}

export function qaPoolVoteTxRequest(subjectTxHash: string, vote: QaVoteKind): {
  type: "qa_pool_vote";
  subject: string;
  vote: QaVoteKind;
} {
  const hex = normalizeVoterHex(subjectTxHash);
  if (!isAccountHex(hex)) {
    throw new Error("QA vote subject must be a 32-byte transaction hash.");
  }
  return { type: "qa_pool_vote", subject: `0x${hex}`, vote };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return [];
  return v as string[];
}

export async function walletAccounts(provider: BoingInjectedProvider): Promise<string[]> {
  const a = await provider.request({ method: "boing_accounts", params: [] });
  return asStringArray(a);
}

export async function walletRequestAccounts(provider: BoingInjectedProvider): Promise<string[]> {
  const a = await provider.request({ method: "boing_requestAccounts", params: [] });
  const list = asStringArray(a);
  if (list.length === 0) {
    throw new Error("Boing Express did not return an account. Unlock the wallet and try again.");
  }
  return list;
}

export async function walletChainIdHex(provider: BoingInjectedProvider): Promise<string> {
  const id = await provider.request({ method: "boing_chainId", params: [] });
  if (typeof id !== "string" || !id.startsWith("0x")) {
    throw new Error("Wallet did not return a Boing chain id.");
  }
  return id.toLowerCase();
}

export async function ensureWalletChain(
  provider: BoingInjectedProvider,
  network: NetworkId
): Promise<void> {
  const want = chainIdHexForNetwork(network).toLowerCase();
  const have = await walletChainIdHex(provider);
  if (have === want) return;
  await provider.request({ method: "boing_switchChain", params: [{ chainId: want }] });
}

export async function walletSendTransaction(
  provider: BoingInjectedProvider,
  tx: Record<string, unknown>
): Promise<string> {
  const out = await provider.request({ method: "boing_sendTransaction", params: [tx] });
  if (typeof out !== "string" || !out.trim()) {
    throw new Error("Wallet did not return a transaction hash.");
  }
  return out;
}

export async function walletSignTransaction(
  provider: BoingInjectedProvider,
  tx: Record<string, unknown>
): Promise<string> {
  const out = await provider.request({ method: "boing_signTransaction", params: [tx] });
  if (typeof out !== "string" || !out.trim()) {
    throw new Error("Wallet did not return a signed transaction.");
  }
  return out;
}

/** Sign raw message bytes (UTF-8 string or `0x` hex). Returns `0x`-prefixed 64-byte signature. */
export async function walletSignMessage(
  provider: BoingInjectedProvider,
  message: string
): Promise<string> {
  const out = await provider.request({ method: "boing_signMessage", params: [message] });
  if (typeof out !== "string" || !out.trim()) {
    throw new Error("Wallet did not return a message signature.");
  }
  const sig = out.trim();
  return sig.startsWith("0x") ? sig : `0x${sig}`;
}

type ProviderErrorShape = {
  code?: number;
  message?: string;
  data?: { boingCode?: string; rpc?: { code?: number; message?: string } };
};

export function isWalletUserRejected(err: unknown): boolean {
  const o = err as ProviderErrorShape;
  const code = typeof o?.code === "number" ? o.code : undefined;
  const boingCode = typeof o?.data?.boingCode === "string" ? o.data.boingCode : "";
  const msg = typeof o?.message === "string" ? o.message : "";
  return (
    code === 4001 ||
    boingCode === "BOING_USER_REJECTED" ||
    boingCode === "BOING_USER_REJECTED_SIGNING" ||
    /user rejected|denied|cancelled|canceled/i.test(msg)
  );
}

export function isQaPoolVoteUnsupported(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err
    ? String((err as { message?: unknown }).message ?? "")
    : String(err);
  return /unsupported transaction type:\s*qa_pool_vote/i.test(msg) || /qa_pool_vote/.test(msg) && /unsupported/i.test(msg);
}

export function mapWalletErrorToUi(err: unknown): string {
  if (isWalletUserRejected(err)) {
    return "Request was cancelled in Boing Express.";
  }
  if (isQaPoolVoteUnsupported(err)) {
    return "This Boing Express build cannot sign QA votes yet. Update the wallet, then try again.";
  }
  const o = err as ProviderErrorShape;
  const boingCode = typeof o?.data?.boingCode === "string" ? o.data.boingCode : "";
  const rpcMsg = o?.data?.rpc?.message;
  if (typeof rpcMsg === "string" && rpcMsg.trim()) return rpcMsg.trim();
  if (boingCode === "BOING_WALLET_LOCKED") return "Unlock Boing Express to continue.";
  if (boingCode === "BOING_NO_WALLET") {
    return "No wallet in Boing Express. Create or import one in the extension.";
  }
  if (boingCode === "BOING_ORIGIN_NOT_CONNECTED") {
    return "Connect this site in Boing Express first.";
  }
  const msg = typeof o?.message === "string" ? o.message.trim() : "";
  if (msg) return msg.length > 200 ? `${msg.slice(0, 197)}…` : msg;
  return "Wallet request failed. Unlock Boing Express and try again.";
}

export function firstAccountHex(accounts: string[]): string | null {
  const hex = accounts[0] ? normalizeVoterHex(accounts[0]) : "";
  return isAccountHex(hex) ? hex : null;
}

/** Chrome Web Store listing for the Boing Express extension. */
export const BOING_EXPRESS_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/hhknjdhknnghccmfnfafbkapjljicbfh";

/**
 * User-facing explanation when no `window.boing` provider is present.
 * Distinguishes mobile / non-Chromium browsers (extension cannot run there) from desktop Chrome
 * where the extension is simply not installed.
 */
export function walletMissingMessage(userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string {
  const ua = userAgent || "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (mobile) {
    return "Boing Express runs as a desktop Chrome extension, so it can't connect on this mobile browser. Connect with the boing.express web wallet instead: a boing.express window opens for each approval (allow popups for this site).";
  }
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  if (!chromium) {
    return "Boing Express is a Chrome extension. Open this page in Chrome, Edge, or Brave with the extension installed, or use the web wallet at boing.express.";
  }
  return "Boing Express isn't installed in this browser. Install it from the Chrome Web Store, then reload this page.";
}