"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  explorerAccountHref,
  explorerAssetHref,
  explorerBlockHashHref,
  explorerTxHref,
} from "@/lib/explorer-href";
import { normalizeHex64, shortenHash, toPrefixedHex64 } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";

export type ExplorerHexKind = "account" | "asset" | "tx" | "block-hash";

function hrefFor(kind: ExplorerHexKind, hex64: string, network: string): string {
  switch (kind) {
    case "account":
      return explorerAccountHref(hex64, network);
    case "asset":
      return explorerAssetHref(hex64, network);
    case "tx":
      return explorerTxHref(hex64, network);
    case "block-hash":
      return explorerBlockHashHref(hex64, network);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function ExplorerHexLink({
  value,
  network,
  kind,
  head = 10,
  tail = 8,
  copy = false,
  className,
  children,
}: {
  value: string | null | undefined;
  network: string;
  kind: ExplorerHexKind;
  head?: number;
  tail?: number;
  copy?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const hex = value ? normalizeHex64(value) : "";
  if (!hex) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }
  const href = hrefFor(kind, hex, network);
  const label = children ?? shortenHash(hex, head, tail);
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <Link
        href={href}
        title={`0x${hex}`}
        className={className ?? "address-link text-xs"}
      >
        {label}
      </Link>
      {copy ? <CopyButton value={toPrefixedHex64(hex)} label="Copy" /> : null}
    </span>
  );
}
