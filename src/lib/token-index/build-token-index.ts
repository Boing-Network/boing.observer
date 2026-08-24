import "server-only";

import type { BoingClient } from "boing-sdk";
import {
  buildNativeDexIntegrationOverridesFromProcessEnv,
  fetchBlocksWithReceiptsForHeightRange,
  fetchNativeDexDirectorySnapshot,
} from "boing-sdk";
import { tryPredictDeployedContractAddressFromDeployTx } from "@/lib/deploy-contract-address";
import { receiptReturnDataHex, tryParseCreatedAccountIdFromDeployReturnData } from "@/lib/deploy-receipt";
import { resolveNativeDexFactoryForExplorer } from "@/lib/resolve-native-dex-factory";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";
import {
  getTxPayloadInner,
  getTxPayloadKind,
  isContractDeployPayloadKind,
} from "@/lib/tx-payload";
import type { TokenIndexAssetKind, TokenIndexJsonEntry, TokenIndexResult } from "./types";

export type { TokenIndexAssetKind, TokenIndexJsonEntry, TokenIndexResult } from "./types";

type MutableEntry = {
  address: string;
  kind: TokenIndexAssetKind;
  sources: Set<"deploy" | "dex">;
  assetName: string | null;
  assetSymbol: string | null;
  purposeCategory: string | null;
  deployer: string | null;
  firstSeenBlock: number;
  deployTxId: string | null;
};

function inferAssetKind(purpose: string | undefined | null): TokenIndexAssetKind {
  const p = (purpose ?? "").toLowerCase();
  if (p.includes("nft") || p.includes("collection")) return "nft";
  if (p.includes("fungible") || p.includes("token")) return "fungible";
  return "other";
}

function normalizeTxId(raw: string | undefined | null): string | null {
  if (raw == null || raw === "") return null;
  const h = normalizeHex64(raw.replace(/^0x/i, ""));
  return h || null;
}

function ensureEntry(map: Map<string, MutableEntry>, address: string): MutableEntry {
  let e = map.get(address);
  if (!e) {
    e = {
      address,
      kind: "other",
      sources: new Set(),
      assetName: null,
      assetSymbol: null,
      purposeCategory: null,
      deployer: null,
      firstSeenBlock: Number.MAX_SAFE_INTEGER,
      deployTxId: null,
    };
    map.set(address, e);
  }
  return e;
}

function applyDeployRow(
  map: Map<string, MutableEntry>,
  row: {
    address: string;
    blockHeight: number;
    txId: string | null;
    deployer: string | null;
    purposeCategory: string | null;
    assetName: string | null;
    assetSymbol: string | null;
  },
) {
  const e = ensureEntry(map, row.address);
  e.sources.add("deploy");
  const k = inferAssetKind(row.purposeCategory ?? undefined);
  if (k !== "other") e.kind = k;
  else if (e.kind === "other" && (row.assetName || row.assetSymbol)) e.kind = "fungible";
  if (row.blockHeight < e.firstSeenBlock) {
    e.firstSeenBlock = row.blockHeight;
    e.deployTxId = row.txId;
  }
  if (row.purposeCategory && !e.purposeCategory) e.purposeCategory = row.purposeCategory;
  if (row.assetName && !e.assetName) e.assetName = row.assetName;
  if (row.assetSymbol && !e.assetSymbol) e.assetSymbol = row.assetSymbol;
  if (row.deployer && !e.deployer) e.deployer = row.deployer;
}

function applyDexToken(map: Map<string, MutableEntry>, tokenHexWith0x: string, blockHeight: number) {
  const raw = tokenHexWith0x.replace(/^0x/i, "");
  const address = normalizeHex64(raw);
  if (!address) return;
  const e = ensureEntry(map, address);
  e.sources.add("dex");
  if (blockHeight < e.firstSeenBlock) {
    e.firstSeenBlock = blockHeight;
  }
}

/** Inclusive height range; uses parallel block fetches (see `maxConcurrent`). */
export async function buildTokenIndexForHeightRange(
  client: BoingClient,
  fromHeight: number,
  toHeight: number,
  options?: { maxConcurrent?: number },
): Promise<TokenIndexResult> {
  if (!Number.isInteger(fromHeight) || !Number.isInteger(toHeight) || fromHeight < 0 || toHeight < fromHeight) {
    throw new RangeError("Invalid height range");
  }

  const info = await client.getNetworkInfo();
  const headHeight = info.head_height;
  const chainId = info.chain_id ?? null;

  const maxConcurrent = Math.min(12, Math.max(1, options?.maxConcurrent ?? 6));

  const factory = await resolveNativeDexFactoryForExplorer(client);
  const dexOverridesRaw = buildNativeDexIntegrationOverridesFromProcessEnv();
  const dexOverrides = {
    ...dexOverridesRaw,
    ...(factory ? { nativeDexFactoryAccountHex: factory } : {}),
  };
  const dexOverridesArg = Object.keys(dexOverrides).length ? dexOverrides : undefined;

  const [bundles, dexSnap] = await Promise.all([
    fetchBlocksWithReceiptsForHeightRange(client, fromHeight, toHeight, {
      maxConcurrent,
      onMissingBlock: "omit",
    }),
    factory
      ? fetchNativeDexDirectorySnapshot(client, {
          registerLogs: { fromBlock: fromHeight, toBlock: toHeight },
          overrides: dexOverridesArg,
        })
      : Promise.resolve(null),
  ]);

  const indexWarnings: string[] = [];
  indexWarnings.push(
    "Boing deploy receipts use empty return_data today; new contract ids are inferred with the same CREATE2 / nonce-derived rules as the node.",
  );

  if (!factory) {
    indexWarnings.push(
      "No live canonical native DEX factory (RPC end_user hint or host env override). register_pair tokens were not merged — only included contract deploys appear here. The DEX token directory (/dex/tokens) stays empty until a factory is published on this chain.",
    );
  } else if (dexSnap?.registerLogs == null) {
    indexWarnings.push("register_pair log fetch was skipped despite a factory hint — check RPC getLogs limits.");
  } else if (dexSnap.registerLogs.length === 0) {
    indexWarnings.push(
      "No register_pair events in this block window. Increase scan depth or Rescan after the pool was registered on-chain.",
    );
  }

  const map = new Map<string, MutableEntry>();
  let deployTxSeen = 0;
  let deployIndexed = 0;

  for (const bundle of bundles) {
    const block = bundle.block;
    const txs = block.transactions as Array<{ sender?: unknown; payload?: unknown }>;
    const receipts = block.receipts ?? [];
    const height = bundle.height;

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (!tx || tx.payload === undefined) continue;
      const kind = getTxPayloadKind(tx.payload);
      if (!isContractDeployPayloadKind(kind)) continue;
      deployTxSeen += 1;
      const receipt = receipts[i] ?? null;
      if (receipt && receipt.success === false) continue;
      const addr =
        tryParseCreatedAccountIdFromDeployReturnData(receiptReturnDataHex(receipt)) ??
        tryPredictDeployedContractAddressFromDeployTx(tx, tx.payload);
      if (!addr) continue;
      deployIndexed += 1;
      const inner = getTxPayloadInner(tx.payload);
      const purpose =
        typeof inner.purpose_category === "string" ? inner.purpose_category : null;
      const assetName = typeof inner.asset_name === "string" ? inner.asset_name : null;
      const assetSymbol = typeof inner.asset_symbol === "string" ? inner.asset_symbol : null;
      const deployer = hexForLink(tx.sender) || null;
      const txId = receipt ? normalizeTxId(receipt.tx_id) : null;

      applyDeployRow(map, {
        address: addr,
        blockHeight: height,
        txId,
        deployer,
        purposeCategory: purpose,
        assetName,
        assetSymbol,
      });
    }
  }

  if (deployTxSeen === 0) {
    indexWarnings.push(
      "No ContractDeploy transactions in this window. boing.finance shows Deploy submitted when the mempool accepts a tx; this index only lists tokens after that tx is included in a block.",
    );
  } else if (deployIndexed === 0) {
    indexWarnings.push(
      `Found ${deployTxSeen} deploy transaction(s) but could not derive a contract id (failed receipt, or missing sender/nonce for CREATE2 / nonce prediction).`,
    );
  }

  const dexRows = dexSnap?.registerLogs ?? [];
  for (const row of dexRows) {
    const bh = row.block_height;
    applyDexToken(map, row.tokenAHex, bh);
    applyDexToken(map, row.tokenBHex, bh);
  }

  const entries: TokenIndexJsonEntry[] = Array.from(map.values())
    .filter((e) => e.firstSeenBlock !== Number.MAX_SAFE_INTEGER)
    .map((e) => ({
      address: e.address,
      kind: e.kind,
      sources: Array.from(e.sources).sort(),
      assetName: e.assetName,
      assetSymbol: e.assetSymbol,
      purposeCategory: e.purposeCategory,
      deployer: e.deployer,
      firstSeenBlock: e.firstSeenBlock,
      deployTxId: e.deployTxId,
    }))
    .sort((a, b) => {
      if (b.firstSeenBlock !== a.firstSeenBlock) return b.firstSeenBlock - a.firstSeenBlock;
      return a.address.localeCompare(b.address);
    });

  return {
    chainId,
    headHeight,
    scannedFromHeight: fromHeight,
    scannedToHeight: toHeight,
    blockBundlesFetched: bundles.length,
    dexRegisterRows: dexRows.length,
    entries,
    indexWarnings,
  };
}
