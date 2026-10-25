import type { RpcProtocolSpecs } from "./rpc-types";

export interface ProtocolSpecSection {
  name: string;
  /** Pretty JSON of the section, for a read-only disclosure. */
  json: string;
}

/**
 * Split `method_catalog.protocol_specs` into displayable sections. The block is additive-only upstream, so any
 * object-valued key is a section (new ones appear without an explorer release); scalars (`version`, `note`)
 * are returned separately. Tolerates a missing or malformed block (older nodes) by returning `null`.
 */
export function describeProtocolSpecs(
  specs: RpcProtocolSpecs | null | undefined,
): { version: number | null; note: string | null; sections: ProtocolSpecSection[] } | null {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null;
  const sections: ProtocolSpecSection[] = [];
  for (const [name, value] of Object.entries(specs)) {
    if (value !== null && typeof value === "object") {
      sections.push({ name, json: JSON.stringify(value, null, 2) });
    }
  }
  return {
    version: typeof specs.version === "number" ? specs.version : null,
    note: typeof specs.note === "string" ? specs.note : null,
    sections,
  };
}