/**
 * Tolerant lookup of an optional `boing_getNetworkInfo` field. Looks at the top level first, then one object level
 * down (for example under `consensus`, `state` or `end_user`), because new fields have been added both ways.
 * `found` distinguishes "key present with value null" (the node says "none / off") from "key absent" (older node).
 */
export function findNodeInfoField(info: unknown, key: string): { found: boolean; value: unknown } {
  if (!info || typeof info !== "object" || Array.isArray(info)) return { found: false, value: undefined };
  const rec = info as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rec, key)) return { found: true, value: rec[key] };
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object" && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, key)) {
      return { found: true, value: (v as Record<string, unknown>)[key] };
    }
  }
  return { found: false, value: undefined };
}