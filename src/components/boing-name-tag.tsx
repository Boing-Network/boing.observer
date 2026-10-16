"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchReverseName, nameHref } from "@/lib/boing-names";
import type { NetworkId } from "@/lib/rpc-methods";

/** Small chip with an address's verified primary `.boing` name (renders nothing when it has none). */
export function BoingNameTag({ address, network, className }: { address: string; network: string; className?: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setName(null);
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(address)) return;
    fetchReverseName(network as NetworkId, address)
      .then((r) => {
        if (live) setName(r?.verified ? r.name : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [address, network]);
  if (!name) return null;
  return (
    <Link
      href={nameHref(name, network)}
      className={
        className ??
        "rounded-full border border-network-cyan/40 bg-network-cyan/10 px-2 py-0.5 text-xs font-semibold text-network-cyan hover:bg-network-cyan/20"
      }
      title={`${name}.boing (primary name)`}
      data-testid="boing-name-tag"
    >
      {name}.boing
    </Link>
  );
}