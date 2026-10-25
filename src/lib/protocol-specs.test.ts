import { describe, expect, it } from "vitest";
import { describeProtocolSpecs } from "./protocol-specs";

describe("describeProtocolSpecs", () => {
  it("returns null for absent or malformed blocks (older nodes)", () => {
    expect(describeProtocolSpecs(undefined)).toBeNull();
    expect(describeProtocolSpecs(null)).toBeNull();
    expect(describeProtocolSpecs([] as never)).toBeNull();
  });

  it("splits scalars from object sections and keeps future sections", () => {
    const out = describeProtocolSpecs({
      version: 1,
      note: "additive only",
      priority_tips: { units: "ledger units" },
      block_signatures: { signatures: { required_from_height: "x" } },
      brand_new_section: { a: 1 },
    });
    expect(out?.version).toBe(1);
    expect(out?.note).toBe("additive only");
    expect(out?.sections.map((s) => s.name)).toEqual(["priority_tips", "block_signatures", "brand_new_section"]);
    expect(JSON.parse(out!.sections[0].json)).toEqual({ units: "ledger units" });
  });

  it("ignores non-numeric versions", () => {
    expect(describeProtocolSpecs({ version: "1" as never })?.version).toBeNull();
  });
});