/**
 * Explorer mapping of every `PayloadVariant` from `@boing-network/boing-sdk`.
 * RPC returns serde externally tagged JSON (`{ "NameRegister": { … } }`); tags match
 * the Rust/`PayloadVariant` PascalCase names (and common snake_case aliases).
 */
import { PayloadVariant } from "@boing-network/boing-sdk";
import type { TxPayloadKind } from "./rpc-types";

/** SDK discriminant names — source of truth for the wire catalog. */
export type PayloadVariantName = keyof typeof PayloadVariant;

/**
 * Display kind for a SDK variant. `ContractCallWithValue` folds into `ContractCall`
 * (same UI; value is shown via the `value` field).
 */
export type CatalogDisplayKind = Exclude<TxPayloadKind, "Unknown">;

/** Human-readable label for every SDK payload variant (including reserved / not yet common). */
export const PAYLOAD_VARIANT_LABELS: Record<PayloadVariantName, string> = {
  Transfer: "Transfer",
  ContractCall: "Contract call",
  ContractDeploy: "Contract deploy",
  ContractDeployWithPurpose: "Contract deploy (purpose)",
  ContractDeployWithPurposeAndMetadata: "Contract deploy (metadata)",
  Bond: "Bond",
  Unbond: "Unbond",
  ClaimUnbond: "Claim unbond",
  QaPoolVote: "QA pool vote",
  Batch: "Batch",
  ValidatorRegister: "Validator register",
  ValidatorDeregister: "Validator deregister",
  ValidatorUnjail: "Validator unjail",
  NameCommit: "Name commit",
  NameRegister: "Name register",
  NameRenew: "Name renew",
  NameTransfer: "Name transfer",
  NameSetTarget: "Name set target",
  NameSetPrimary: "Name set primary",
  NameRelease: "Name release",
  ContractCallWithValue: "Contract call (with value)",
  PutBlob: "Put media blob",
  BlobAnnounce: "Blob announce",
  RenewMediaBlobPin: "Renew media blob pin",
  PayBlobSample: "Pay blob sample",
  RegisterBlobSampleOffer: "Register blob sample offer",
  SettleBlobSampleMatch: "Settle blob sample match",
  CancelBlobSampleOffer: "Cancel blob sample offer",
  ChallengeBlobSampleServe: "Challenge blob sample serve",
  RespondBlobSampleServe: "Respond blob sample serve",
  SubmitSlashAppeal: "Submit slash appeal",
  ResolveSlashAppeal: "Resolve slash appeal",
  ResolveSlashAppealAttested: "Resolve slash appeal (attested)",
  ResolveSlashAppealBlsAggregate: "Resolve slash appeal (BLS aggregate)",
  GrantBlobDownload: "Grant blob download",
  RevokeBlobDownload: "Revoke blob download",
};

/** Variants that are wire-defined but not yet consensus-admitted (or rarely seen). */
export const PAYLOAD_VARIANT_RESERVED: ReadonlySet<PayloadVariantName> = new Set([
  "ResolveSlashAppealBlsAggregate",
]);

function displayKindForVariant(name: PayloadVariantName): CatalogDisplayKind {
  if (name === "ContractCallWithValue") return "ContractCall";
  return name;
}

/** Every SDK `PayloadVariant` key → explorer display kind. */
export const PAYLOAD_VARIANT_TO_KIND: Record<PayloadVariantName, CatalogDisplayKind> = Object.fromEntries(
  (Object.keys(PayloadVariant) as PayloadVariantName[]).map((name) => [name, displayKindForVariant(name)]),
) as Record<PayloadVariantName, CatalogDisplayKind>;

function snakeCase(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Tagged JSON keys (PascalCase + snake_case) → display kind. Built from SDK catalog. */
export const TAGGED_PAYLOAD_KIND_BY_KEY: Record<string, CatalogDisplayKind> = (() => {
  const out: Record<string, CatalogDisplayKind> = {};
  for (const name of Object.keys(PayloadVariant) as PayloadVariantName[]) {
    const kind = PAYLOAD_VARIANT_TO_KIND[name];
    out[name] = kind;
    out[snakeCase(name)] = kind;
  }
  // Legacy aliases already used in the wild / tests
  out.claim_unbond = "ClaimUnbond";
  out.qa_pool_vote = "QaPoolVote";
  return out;
})();

export function resolveTaggedPayloadKind(key: string): CatalogDisplayKind | null {
  if (key in TAGGED_PAYLOAD_KIND_BY_KEY) return TAGGED_PAYLOAD_KIND_BY_KEY[key];
  const lower = key.toLowerCase();
  for (const [canonical, kind] of Object.entries(TAGGED_PAYLOAD_KIND_BY_KEY)) {
    if (canonical.toLowerCase() === lower) return kind;
  }
  return null;
}

/** Label for a display kind (badge / narrative). Falls back to the kind string. */
export function payloadKindLabel(kind: TxPayloadKind): string {
  if (kind === "Unknown") return "Unknown";
  if (kind === "ContractCall") return PAYLOAD_VARIANT_LABELS.ContractCall;
  if (kind in PAYLOAD_VARIANT_LABELS) {
    return PAYLOAD_VARIANT_LABELS[kind as PayloadVariantName];
  }
  return kind;
}

/** Catalog entries for smoke tests / docs: every SDK variant has index, label, display kind. */
export function listPayloadCatalog(): Array<{
  name: PayloadVariantName;
  index: number;
  label: string;
  displayKind: CatalogDisplayKind;
  reserved: boolean;
}> {
  return (Object.keys(PayloadVariant) as PayloadVariantName[])
    .map((name) => ({
      name,
      index: PayloadVariant[name],
      label: PAYLOAD_VARIANT_LABELS[name],
      displayKind: PAYLOAD_VARIANT_TO_KIND[name],
      reserved: PAYLOAD_VARIANT_RESERVED.has(name),
    }))
    .sort((a, b) => a.index - b.index);
}
