# Asset pages (`/asset`, `/tokens`)

Details moved out of the README feature table. Routes: `/asset/:address`, `/asset/:address/item/:tokenId`, `/tokens`.

- **Metadata scan and reference NFT collections.** Collections show **per-item** profiles (owner and metadata XOR slots). FreshMint-style hash token ids are resolved by decoding mint calldata in recent blocks. See [BOING-REFERENCE-NFT.md](https://github.com/Boing-Network/boing.network/blob/main/docs/BOING-REFERENCE-NFT.md) (v3 `mint_batch` with n <= 500 is a single receipt).
- **Linked tokens and collections** (plain-language UI). Official NFT-to-fungible links are read from the on-chain registry on asset, account, and NFT item pages. The read is read-only (`links_count` / `get_link_at`, tombstones skipped). See [BOING-LINKED-NFT-TOKEN.md](https://github.com/Boing-Network/boing.network/blob/main/docs/BOING-LINKED-NFT-TOKEN.md).
- **Builder attested (planned, read-only).** An optional builder signal from a separate on-chain registry when an active attestation exists for a companion pair. The UI is not shipped yet. See [BOING-BUILDER-ATTESTATION.md](https://github.com/Boing-Network/boing.network/blob/main/docs/BOING-BUILDER-ATTESTATION.md).

Related config: `NEXT_PUBLIC_BOING_LINKED_NFT_TOKEN_REGISTRY`, `NEXT_PUBLIC_BOING_BUILDER_ATTESTATION_REGISTRY`, `NFT_OWNER_INDEXER_URL` (see [README.md](../README.md) and [OPERATIONS.md](OPERATIONS.md)).
