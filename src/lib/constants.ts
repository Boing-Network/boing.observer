/** Canonical site URL for metadata, links, and structured data. */
export const SITE_URL = "https://boing.observer";

/** Canonical website; desktop clients may merge `GET https://boing.network/api/networks` → `meta` / `meta.ecosystem` (VIBEMINER-INTEGRATION.md). */
export const WEBSITE_URL = "https://boing.network";

/** Official Boing Network community Discord invite. */
export const DISCORD_URL = "https://discord.gg/K3w9nbUw4N";

/** Canonical Boing Wallet (boing.express). */
export const WALLET_URL = "https://boing.express";

/** Canonical DeFi / token + NFT create surfaces (boing.finance). */
export const FINANCE_URL = "https://boing.finance";

/** Linked NFT↔token project hub on boing.finance (write / claim / register). */
export const FINANCE_LINKED_PROJECT_URL = `${FINANCE_URL}/linked-project`;

/** FreshMint marketplace (collection linked-token write surface). */
export const FRESHMINT_URL = "https://fresh-mint-marketplace.vercel.app";

/**
 * GitHub `owner/repo` where `main` contains `docs/` (RPC spec, canonical QA JSON, alignment docs).
 * Default is the repo that actually hosts these paths today. Override at build time when docs live
 * elsewhere, e.g. `NEXT_PUBLIC_BOING_PROTOCOL_DOCS_REPO=boing-network/boing.network`.
 */
const rawRepo = process.env.NEXT_PUBLIC_BOING_PROTOCOL_DOCS_REPO?.trim();
/** Non-empty `owner/repo` only; otherwise default development repo where `docs/` exists on `main`. */
export const BOING_PROTOCOL_DOCS_REPO =
  rawRepo && rawRepo.includes("/") ? rawRepo : "Boing-Network/boing.network";

/** Base URL for external Boing Network docs (GitHub blob UI). */
export const DOCS_BASE = `https://github.com/${BOING_PROTOCOL_DOCS_REPO}/blob/main/docs`;

/** Protocol doc for the on-chain linked NFT↔fungible token registry. */
export const LINKED_NFT_TOKEN_DOC_URL = `${DOCS_BASE}/BOING-LINKED-NFT-TOKEN.md`;

/** Canonical QA documentation page in the Boing Network repo. */
export const QA_DOC_URL = `${DOCS_BASE}/QUALITY-ASSURANCE-NETWORK.md`;

/** JSON-RPC reference (QA methods, error codes, operator auth). */
export const RPC_SPEC_URL = `${DOCS_BASE}/RPC-API-SPEC.md`;

/** Raw files on `main` (browser / fetch friendly). */
export const DOCS_RAW_BASE = `https://raw.githubusercontent.com/${BOING_PROTOCOL_DOCS_REPO}/main/docs`;

/** Canonical baseline QA registry JSON (code default; live nodes may differ). */
export const CANONICAL_QA_REGISTRY_JSON_URL = `${DOCS_RAW_BASE}/config/qa_registry.canonical.json`;

/** Canonical baseline pool governance JSON (production default shape). */
export const CANONICAL_QA_POOL_CONFIG_JSON_URL = `${DOCS_RAW_BASE}/config/qa_pool_config.canonical.json`;

/** Explains canonical vs live QA config and links to RPC. */
export const CANONICAL_QA_DOC_URL = `${DOCS_BASE}/config/CANONICAL-QA-REGISTRY.md`;

/** Cross-app alignment: URLs, RPC envs, chain IDs, address format (§4). */
export const THREE_CODEBASE_ALIGNMENT_URL = `${DOCS_BASE}/THREE-CODEBASE-ALIGNMENT.md`;

/** Dependent-project backlog: Express, Observer, partners. */
export const HANDOFF_DEPENDENT_PROJECTS_URL = `${DOCS_BASE}/HANDOFF-DEPENDENT-PROJECTS.md`;

/** Native DEX directory Worker (D1/R2), `GET /v1/directory/meta` / `pools`, snapshot caveats — optional consumer for pool/LP UI. */
export const NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL = `${DOCS_BASE}/HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md`;

/** Hosted indexer / durable read path (OBS-1); not implemented in this explorer repo by default. */
export const OBSERVER_HOSTED_SERVICE_URL = `${DOCS_BASE}/OBSERVER-HOSTED-SERVICE.md`;

/** Durable reference-NFT owner index (D1 Worker) — deploy steps, API, `NFT_OWNER_INDEXER_URL`. */
export const NFT_OWNER_INDEX_HANDOFF_DOC_URL = `${DOCS_BASE}/HANDOFF_NFT_OWNER_INDEX.md`;

/** §4 — 32-byte AccountId (64 hex), not 20-byte Ethereum addresses. */
export const ADDRESS_FORMAT_ALIGNMENT_URL = `${THREE_CODEBASE_ALIGNMENT_URL}#4-token-and-address-format`;

/** Local VibeMiner / localhost:8545 vs public testnet RPC (THREE-CODEBASE-ALIGNMENT §2.1). */
export const QA_RPC_TWO_SURFACES_DOC_URL = `${THREE_CODEBASE_ALIGNMENT_URL}#21-qa-registry-rpc-boing_getqaregistry--two-different-surfaces`;

/** Canonical public faucet page on boing.network. */
export const NETWORK_FAUCET_URL = `${WEBSITE_URL}/faucet`;

/** Canonical public “Join testnet” hub on boing.network (portal home is /testnet). */
export const NETWORK_TESTNET_URL = `${WEBSITE_URL}/testnet/join`;
