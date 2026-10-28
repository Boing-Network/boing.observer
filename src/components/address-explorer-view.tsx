"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchAccount } from "@/lib/rpc-methods";
import { explorerAssetHref } from "@/lib/explorer-href";
import type { Account } from "@/lib/rpc-types";
import { isHex64, normalizeAddress, formatBalance, toPrefixedHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { useNativeUnitConfig } from "@/hooks/use-native-unit-config";
import { CopyButton } from "@/components/copy-button";
import { ExplorerCrumbs } from "@/components/explorer-crumbs";
import dynamic from "next/dynamic";
import { formatBoingBase, ledgerToBaseUnits } from "@/lib/native-unit";
import { AccountContractHints } from "@/components/account-contract-hints";
import { AccountTxHistory } from "@/components/account-tx-history";
import { AccountNames } from "@/components/account-names";
import { BoingNameTag } from "@/components/boing-name-tag";
import { AssetMediaThumb } from "@/components/asset-media-thumb";
import { AssetMetadataSection, type ExplorerAssetProfilePayload } from "@/components/asset-metadata-section";
import { LinkedCompanionsSection } from "@/components/linked-companions-section";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "@/lib/extract-media-url";
import { formatAssetKindLabel } from "@/lib/asset-kind-label";
import { ADDRESS_FORMAT_ALIGNMENT_URL, NETWORK_FAUCET_URL } from "@/lib/constants";

/**
 * Heavy, below-the-fold widgets are code-split so the account/asset First Load JS stays small:
 * recharts (~90 kB gz) for the balance chart, and the contract call UI / NFT gallery (SDK + crypto).
 */
function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-boing-navy-lighter/60 p-4 text-sm text-boing-gray" aria-busy="true">
      {label}
    </div>
  );
}
const AccountBalanceMix = dynamic(
  () => import("@/components/account-balance-mix").then((m) => m.AccountBalanceMix),
  { ssr: false, loading: () => <PanelSkeleton label="Loading balance chart..." /> }
);
const ContractFunctions = dynamic(
  () => import("@/components/contract-functions").then((m) => m.ContractFunctions),
  { ssr: false, loading: () => <PanelSkeleton label="Loading contract tools..." /> }
);
const AccountNftGallery = dynamic(
  () => import("@/components/account-nft-gallery").then((m) => m.AccountNftGallery),
  { ssr: false, loading: () => <PanelSkeleton label="Loading NFTs..." /> }
);

export function AddressExplorerView({ variant }: { variant: "account" | "asset" }) {
  const params = useParams();
  const { network, ready } = useNetwork();
  useNativeUnitConfig(network);
  const addressParam = params?.address as string;
  const address = addressParam ? normalizeAddress(addressParam) : "";
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [assetProfile, setAssetProfile] = useState<ExplorerAssetProfilePayload | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Auto-scan deploy metadata on both account and asset pages so NFT collection previews can load.
  const [wantDeployScan, setWantDeployScan] = useState(true);
  const [profileScope, setProfileScope] = useState({ network, address });
  if (profileScope.network !== network || profileScope.address !== address) {
    setProfileScope({ network, address });
    setWantDeployScan(true);
  }

  useEffect(() => {
    if (!isHex64(address)) {
      setLoading(false);
      setError("Invalid account address");
      return;
    }
    if (!ready) return; // wait for ?network= / stored preference so a deep link never queries the wrong chain
    let cancelled = false;
    setLoading(true);
    setError(null);
    const hexId = toPrefixedHex64(address);
    fetchAccount(network, hexId)
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "account"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, ready, address]);

  useEffect(() => {
    if (!isHex64(address)) {
      setProfileLoading(false);
      setAssetProfile(null);
      setProfileError(null);
      return;
    }
    if (!ready) return; // wait for ?network= / stored preference so a deep link never queries the wrong chain
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    const hexId = encodeURIComponent(toPrefixedHex64(address));
    const scan = wantDeployScan ? "1" : "0";
    const nftProbe = wantDeployScan ? "1" : "0";
    fetch(
      `/api/asset/profile?network=${encodeURIComponent(network)}&id=${hexId}&scan=${scan}&nftProbe=${nftProbe}`,
      {
        headers: { Accept: "application/json" },
      },
    )
      .then(async (res) => {
        const j = (await res.json()) as { error?: string } & Partial<ExplorerAssetProfilePayload>;
        if (cancelled) return;
        if (!res.ok) {
          setAssetProfile(null);
          setProfileError(j.error || `HTTP ${res.status}`);
          return;
        }
        if (j.supported === true) {
          setAssetProfile(j as ExplorerAssetProfilePayload);
          setProfileError(null);
        } else {
          setAssetProfile(null);
          setProfileError("Unexpected profile response");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssetProfile(null);
          setProfileError("Could not load asset profile");
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, ready, address, variant, wantDeployScan]);

  const inDexUniverse = Boolean(assetProfile?.dexToken);

  // Do not mount the data widgets (they fetch with `network`) until the deep-link network is resolved.
  if (!ready && isHex64(address)) {
    return <div className="glass-card p-6 text-sm text-[var(--text-muted)]" aria-busy="true">Loading...</div>;
  }

  if (!isHex64(address)) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Account</h1>
        <div className="space-y-2 text-red-400" role="alert">
          <p>
            Invalid address. Boing uses a 32-byte AccountId (64 hex digits, optional{" "}
            <span className="font-mono">0x</span>) for accounts, contracts, and deployed assets — not a 20-byte EVM
            address.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            <a
              href={ADDRESS_FORMAT_ALIGNMENT_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Address format (alignment doc §4)
            </a>
          </p>
        </div>
      </div>
    );
  }

  const title = variant === "asset" ? "Asset" : "Account";
  const identity = assetProfile
    ? (() => {
        const parsed = parseAssetDisplayMetadata(
          assetProfile.tokenIndex?.assetName ?? assetProfile.dexToken?.name ?? null,
          assetProfile.tokenIndex?.assetSymbol ?? assetProfile.dexToken?.symbol ?? null,
        );
        // Only treat as NFT collection when deploy index says so, or real samples exist.
        const kindFromSamples =
          !assetProfile.tokenIndex?.kind &&
          assetProfile.nftSamples &&
          assetProfile.nftSamples.length > 0
            ? "nft"
            : null;
        return {
          ...parsed,
          imageUrl: assetProfile.imageUrl ?? parsed.imageUrl,
          description: assetProfile.description ?? parsed.description,
          kind: assetProfile.tokenIndex?.kind ?? kindFromSamples,
        };
      })()
    : null;
  const showAssetIdentity =
    Boolean(identity) &&
    (variant === "asset" || Boolean(identity?.imageUrl || identity?.displayName || identity?.kind));
  const identityLabel = identity ? formatAssetDisplayLabel(identity, "") : "";
  const alternateHref =
    variant === "asset"
      ? `/account/${address}?network=${encodeURIComponent(network)}`
      : explorerAssetHref(address, network);
  const alternateLabel = variant === "asset" ? "Open as account" : "Open as asset";
  const pendingUnbond =
    account?.pending_unbond != null ? ledgerToBaseUnits(account.pending_unbond, account.decimals ?? 0) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <ExplorerCrumbs
          items={
            variant === "asset"
              ? [
                  { label: "Home", href: "/" },
                  { label: "Tokens", href: `/tokens?network=${encodeURIComponent(network)}` },
                  { label: identityLabel || "Asset" },
                ]
              : [
                  { label: "Home", href: "/" },
                  { label: identityLabel || "Account" },
                ]
          }
        />
        <div className="flex items-start gap-4">
          {showAssetIdentity ? (
            <AssetMediaThumb
              imageUrl={identity?.imageUrl}
              alt={identityLabel || title}
              size="xl"
              kind={identity?.kind}
            />
          ) : null}
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                {identityLabel || title}
              </h1>
              {identity?.kind ? (
                <span className="rounded-full border border-[var(--border-color)] bg-white/5 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {formatAssetKindLabel(identity.kind)}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--border-color)] bg-white/5 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {title}
                </span>
              )}
              {variant === "account" ? <BoingNameTag address={address} network={network} /> : null}
            </div>
            {identityLabel && identityLabel !== title ? (
              <p className="sr-only">
                {title} {address}
              </p>
            ) : null}
            {identity?.description ? (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{identity.description}</p>
            ) : null}
          </div>
        </div>
        {variant === "asset" ? (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Tokens and NFTs are on-chain accounts (32-byte AccountId) that run template bytecode. This page
            highlights supply, deployer, and transactions; developer call selectors stay under Technical details.
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            32-byte Boing AccountId (Ed25519 pubkey hash).{" "}
            <a
              href={ADDRESS_FORMAT_ALIGNMENT_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Format reference
            </a>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="hash break-all font-mono text-sm text-[var(--text-muted)]" title={address}>
            0x{address}
          </p>
          <CopyButton value={toPrefixedHex64(address)} label="Copy address" />
          {!profileLoading && inDexUniverse && (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
              In DEX universe
              <Link href={`/dex/tokens?network=${encodeURIComponent(network)}`} className="text-network-cyan hover:underline">
                Token directory
              </Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link
                href={`/dex/pools?network=${encodeURIComponent(network)}#rpc-dex-pools`}
                className="text-network-cyan hover:underline"
              >
                RPC pools
              </Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link href={explorerAssetHref(address, network)} className="text-network-cyan hover:underline">
                Asset view
              </Link>
            </span>
          )}
        </div>
        <p className="text-xs">
          <Link href={alternateHref} className="text-network-cyan hover:underline">
            {alternateLabel}
          </Link>
        </p>
        {profileError && (
          <p className="text-xs text-amber-300" role="status">
            {profileError}
          </p>
        )}
      </header>

      {profileLoading && isHex64(address) && (
        <div className="glass-card h-32 animate-pulse rounded-lg bg-white/5" aria-busy="true" />
      )}
      {assetProfile && (
        <AssetMetadataSection
          network={network}
          profile={assetProfile}
          scanUsed={wantDeployScan}
          onRequestScan={
            !wantDeployScan
              ? () => setWantDeployScan(true)
              : undefined
          }
        />
      )}

      {isHex64(address) ? <LinkedCompanionsSection network={network} address64={address} /> : null}

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-32" />
          <div className="h-24 bg-white/5 rounded" />
        </div>
      )}
      {error && (
        <p className="text-amber-300" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && account && (
        <section className="space-y-4" aria-labelledby="account-state-heading">
          <h2 id="account-state-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
            On-chain state
          </h2>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="glass-card space-y-4 p-4 sm:p-6">
              <h3 className="sr-only">Balances and nonce</h3>
              <dl className="grid gap-3 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Balance</dt>
                  <dd className="font-mono font-medium text-network-cyan">
                    {formatBoingBase(ledgerToBaseUnits(account.balance, account.decimals ?? 0))} BOING
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Nonce</dt>
                  <dd className="font-mono">{account.nonce}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Stake</dt>
                  <dd className="font-mono text-network-primary-light">{formatBoingBase(ledgerToBaseUnits(account.stake, account.decimals ?? 0))} BOING</dd>
                </div>
                {pendingUnbond != null && pendingUnbond > BigInt(0) ? (
                  <div className="flex flex-wrap gap-x-2" data-testid="account-pending-unbond">
                    <dt className="text-[var(--text-muted)]">Unbonding</dt>
                    <dd className="font-mono text-[var(--text-secondary)]">
                      {formatBoingBase(pendingUnbond)} BOING
                      {account.unbond_unlock_height
                        ? ` (claimable from block #${account.unbond_unlock_height})`
                        : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {network === "testnet" && (
                <p className="text-sm">
                  <a
                    href={`${NETWORK_FAUCET_URL}?address=${encodeURIComponent(toPrefixedHex64(address))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-network-cyan hover:underline"
                  >
                    Get testnet BOING →
                  </a>
                </p>
              )}
            </div>
            <AccountBalanceMix balance={account.balance} stake={account.stake} decimals={account.decimals ?? 0} />
          </div>
          <AccountContractHints
            network={network}
            address64={address}
            rpcInteractionHints={
              assetProfile
                ? {
                    inDexUniverse,
                    poolCount: assetProfile.dexToken?.poolCount,
                    tokenKind: assetProfile.tokenIndex?.kind,
                    purposeCategory: assetProfile.tokenIndex?.purposeCategory ?? null,
                  }
                : null
            }
          />
        </section>
      )}

      {isHex64(address) ? (
        <AccountTxHistory
          address64={address}
          network={network}
          heading={variant === "asset" ? "Token transactions" : "Transaction history"}
          description={
            variant === "asset"
              ? "Transfers, mints, approvals, and other calls that involve this token account — not only the deploy. Prefers the node’s indexed account history when available, with a bounded block scan as fallback."
              : undefined
          }
        />
      ) : null}

      {variant === "account" && isHex64(address) ? <AccountNames address64={address} network={network} /> : null}

      {variant === "account" && isHex64(address) ? (
        <AccountNftGallery address64={address} network={network} />
      ) : null}

      {isHex64(address) ? (
        <ContractFunctions
          network={network}
          address64={address}
          collapseFungibleByDefault={variant === "asset"}
        />
      ) : null}
    </div>
  );
}
