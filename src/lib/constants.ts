/** Canonical site URL for metadata, links, and structured data. */
export const SITE_URL = "https://boing.observer";

/** Canonical Boing Network website URL. */
export const WEBSITE_URL = "https://boing.network";

/** Canonical Boing Wallet (boing.express). */
export const WALLET_URL = "https://boing.express";

/** Base URL for external Boing Network docs (GitHub). */
export const DOCS_BASE =
  "https://github.com/boing-network/boing.network/blob/main/docs";

/** Canonical QA documentation page in the Boing Network repo. */
export const QA_DOC_URL = `${DOCS_BASE}/QUALITY-ASSURANCE-NETWORK.md`;

/** JSON-RPC reference (QA methods, error codes, operator auth). */
export const RPC_SPEC_URL = `${DOCS_BASE}/RPC-API-SPEC.md`;

/** Raw files on `main` (for linking JSON directly in the browser). */
export const DOCS_RAW_BASE =
  "https://raw.githubusercontent.com/boing-network/boing.network/main/docs";

/** Canonical baseline QA registry JSON (code default; live nodes may differ). */
export const CANONICAL_QA_REGISTRY_JSON_URL = `${DOCS_RAW_BASE}/config/qa_registry.canonical.json`;

/** Canonical baseline pool governance JSON (production default shape). */
export const CANONICAL_QA_POOL_CONFIG_JSON_URL = `${DOCS_RAW_BASE}/config/qa_pool_config.canonical.json`;

/** Explains canonical vs live QA config and links to RPC. */
export const CANONICAL_QA_DOC_URL = `${DOCS_BASE}/config/CANONICAL-QA-REGISTRY.md`;

/** Canonical public faucet page on boing.network. */
export const NETWORK_FAUCET_URL = `${WEBSITE_URL}/faucet`;

/** Canonical public “Join testnet” hub on boing.network (portal home is /testnet). */
export const NETWORK_TESTNET_URL = `${WEBSITE_URL}/testnet/join`;
