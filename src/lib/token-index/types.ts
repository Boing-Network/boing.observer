export type TokenIndexAssetKind = "fungible" | "nft" | "other";

export type TokenIndexJsonEntry = {
  address: string;
  kind: TokenIndexAssetKind;
  sources: ("deploy" | "dex")[];
  assetName: string | null;
  assetSymbol: string | null;
  purposeCategory: string | null;
  deployer: string | null;
  firstSeenBlock: number;
  deployTxId: string | null;
  /** Blake3-256 of off-chain launch metadata JSON when present on the deploy payload. */
  descriptionHash?: string | null;
  /** Resolved HTTP(S) image from on-chain name/symbol JSON or off-chain metadata. */
  imageUrl?: string | null;
};

export type TokenIndexResult = {
  chainId: number | null;
  headHeight: number;
  scannedFromHeight: number;
  scannedToHeight: number;
  blockBundlesFetched: number;
  dexRegisterRows: number;
  entries: TokenIndexJsonEntry[];
  /** Non-fatal hints (e.g. factory not resolved, so register_pair merge was skipped). */
  indexWarnings?: string[];
};

/** How this response was produced (disk cache vs live RPC scan). */
export type TokenIndexCacheMeta = {
  /** Where snapshots are stored; `none` if disabled or unavailable (e.g. read-only serverless). */
  backend: "file" | "none";
  /** True when body was loaded from a fresh on-disk snapshot without running a full index this request. */
  hit: boolean;
  /** True when `buildTokenIndexForHeightRange` ran this request. */
  rpcRefreshed: boolean;
  savedAt: string | null;
  /** ISO time when the cached entry is considered stale (TTL from savedAt). */
  staleAfterApprox: string | null;
  ttlSeconds: number;
  /** Chain tip when the snapshot was built (from RPC at scan time). */
  headHeightWhenBuilt: number;
  /** Tip from a lightweight `getNetworkInfo` on this request (for drift UI). */
  currentHeadHeight: number;
  /** Blocks committed after `scannedToHeight` (0 if chain has not advanced past the scan window). */
  blocksPastScanTip: number;
  /**
   * Whether the snapshot was written to disk after an RPC refresh.
   * `null` when durable cache is disabled (`TOKEN_INDEX_CACHE_DIR=off` or no writable dir).
   */
  snapshotPersisted: boolean | null;
};
