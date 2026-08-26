"use client";

import { useState } from "react";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24 max-h-24",
  xl: "h-28 w-28 max-h-28 sm:h-32 sm:w-32",
} as const;

function placeholderLabel(alt: string, kind?: string | null): string {
  const words = alt
    .replace(/·/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w.length > 0 && w.toLowerCase() !== "unnamed");
  if (words.length >= 2) return `${words[0]![0]!}${words[1]![0]!}`.toUpperCase();
  if (words[0] && words[0].length >= 2) return words[0].slice(0, 2).toUpperCase();
  if (words[0]) return words[0].slice(0, 1).toUpperCase();
  return (kind ?? "").toLowerCase() === "nft" ? "NFT" : "TKN";
}

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
  const placeholder = placeholderLabel(alt, kind);

  if (!imageUrl || hidden) {
    return (
      <span
        className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-gradient-to-br from-fuchsia-950/50 via-boing-navy-mid/70 to-cyan-950/40 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]`}
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
      width={size === "xl" ? 128 : size === "lg" ? 96 : size === "md" ? 64 : 40}
      height={size === "xl" ? 128 : size === "lg" ? 96 : size === "md" ? 64 : 40}
      className={`${box} shrink-0 rounded-lg border border-[var(--border-color)] bg-black/20 object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHidden(true)}
    />
  );
}
