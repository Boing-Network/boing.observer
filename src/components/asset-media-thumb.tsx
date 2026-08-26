"use client";

import { useState } from "react";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24 max-h-24",
} as const;

export function AssetMediaThumb({
  imageUrl,
  alt,
  size = "sm",
  kind,
}: {
  imageUrl: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZE_CLASS;
  kind?: string | null;
}) {
  const [hidden, setHidden] = useState(false);
  const box = SIZE_CLASS[size];
  const placeholder = (kind ?? "").toLowerCase() === "nft" ? "NFT" : "TKN";

  if (!imageUrl || hidden) {
    return (
      <span
        className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/50 text-[10px] uppercase text-[var(--text-muted)]`}
        aria-hidden
      >
        {placeholder}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote user/deploy URLs
    <img
      src={imageUrl}
      alt={alt}
      width={size === "lg" ? 96 : size === "md" ? 64 : 40}
      height={size === "lg" ? 96 : size === "md" ? 64 : 40}
      className={`${box} shrink-0 rounded-lg border border-[var(--border-color)] bg-black/20 object-contain`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHidden(true)}
    />
  );
}
