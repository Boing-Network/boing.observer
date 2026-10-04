/**
 * User-facing labels for token-index kinds and deploy purpose categories.
 * Protocol purpose `NFT` / index kind `nft` is an NFT collection contract.
 */

export function isNftPurposeOrKind(value: string | null | undefined): boolean {
  const v = (value ?? "").toLowerCase().trim();
  if (!v) return false;
  return v === "nft" || v.includes("nft") || v.includes("collection");
}

/** Display label for `TokenIndexAssetKind` (and loose purpose strings passed as kind). */
export function formatAssetKindLabel(kind: string | null | undefined): string {
  const k = (kind ?? "").toLowerCase().trim();
  if (!k) return "";
  if (k === "nft" || k === "nft_collection" || k.includes("nft")) return "NFT collection";
  if (k === "fungible" || k === "token") return "Fungible token";
  if (k === "other") return "Other";
  return kind!.trim();
}

/** Display label for deploy `purpose_category` (e.g. tx summaries, badges). */
export function formatPurposeLabel(cat: string | null | undefined): string {
  const c = (cat ?? "").trim();
  if (!c || c.toLowerCase() === "other") return "other";
  const lower = c.toLowerCase();
  if (lower === "nft" || lower === "nft_collection") return "nft collection";
  if (lower === "dapp") return "dApp";
  return lower;
}
