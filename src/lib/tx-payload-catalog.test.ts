import { describe, expect, it } from "vitest";
import { PayloadVariant } from "@boing-network/boing-sdk";
import { buildPayloadDetailLines } from "./tx-details";
import {
  getTxExplorerNarrative,
  getTxPayloadKind,
  getTxPayloadSummary,
  payloadKindLabel,
} from "./tx-payload";
import {
  listPayloadCatalog,
  PAYLOAD_VARIANT_LABELS,
  PAYLOAD_VARIANT_TO_KIND,
  resolveTaggedPayloadKind,
} from "./tx-payload-catalog";

const bytes = (hex: string) => Array.from({ length: 32 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
const TARGET = "d692627aae0123456789abcdef0123456789abcdef0123456789abcd3635237".slice(0, 64);

describe("SDK payload catalog coverage", () => {
  it("lists every PayloadVariant with a human-readable label and display kind", () => {
    const catalog = listPayloadCatalog();
    const names = Object.keys(PayloadVariant) as Array<keyof typeof PayloadVariant>;
    expect(catalog).toHaveLength(names.length);
    expect(catalog.map((e) => e.index)).toEqual([...catalog.map((e) => e.index)].sort((a, b) => a - b));

    for (const name of names) {
      const label = PAYLOAD_VARIANT_LABELS[name];
      expect(label.length).toBeGreaterThan(2);
      expect(label.toLowerCase()).not.toBe("unknown");
      expect(PAYLOAD_VARIANT_TO_KIND[name]).toBeTruthy();
      expect(PAYLOAD_VARIANT_TO_KIND[name]).not.toBe("Unknown");
    }
  });

  it("resolves every tagged PascalCase (and snake_case) key to a non-Unknown kind", () => {
    for (const name of Object.keys(PayloadVariant) as Array<keyof typeof PayloadVariant>) {
      const kind = resolveTaggedPayloadKind(name);
      expect(kind, name).toBeTruthy();
      expect(kind).not.toBe("Unknown");
      // Smoke: tagged empty / body object is recognized by getTxPayloadKind
      expect(getTxPayloadKind({ [name]: {} })).toBe(PAYLOAD_VARIANT_TO_KIND[name]);
      const snake = name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .toLowerCase();
      expect(resolveTaggedPayloadKind(snake)).toBe(PAYLOAD_VARIANT_TO_KIND[name]);
    }
  });

  it("keeps ContractCallWithValue folded into ContractCall for display", () => {
    expect(PAYLOAD_VARIANT_TO_KIND.ContractCallWithValue).toBe("ContractCall");
    expect(getTxPayloadKind({ ContractCallWithValue: { contract: bytes(TARGET), calldata: [1], value: "1" } })).toBe(
      "ContractCall",
    );
  });
});

describe("name claim / registry payloads", () => {
  const nameRegister = {
    NameRegister: {
      name: "nico",
      salt: bytes("22".repeat(32)),
      target: bytes(TARGET),
      years: 1,
    },
  };

  it("decodes tagged NameRegister (Express name claim)", () => {
    expect(getTxPayloadKind(nameRegister)).toBe("NameRegister");
    expect(payloadKindLabel("NameRegister")).toBe("Name register");
    expect(getTxPayloadSummary(nameRegister)).toContain("nico.boing");
    expect(getTxPayloadSummary(nameRegister)).toContain("1y");
    expect(getTxExplorerNarrative(bytes(TARGET), nameRegister)).toContain("nico.boing");
    const lines = buildPayloadDetailLines(nameRegister);
    expect(lines.find((l) => l.label === "Name")?.value).toBe("nico.boing");
    expect(lines.find((l) => l.label === "Years")?.value).toBe("1");
  });

  it("decodes flat Express-style name_register kind", () => {
    const flat = {
      kind: "name_register",
      name: "alice",
      salt: bytes("11".repeat(32)),
      target: bytes(TARGET),
      years: 2,
    };
    expect(getTxPayloadKind(flat)).toBe("NameRegister");
    expect(getTxPayloadSummary(flat)).toContain("alice.boing");
  });

  it("decodes other name registry tagged variants", () => {
    expect(getTxPayloadKind({ NameCommit: { commitment: bytes("33".repeat(32)) } })).toBe("NameCommit");
    expect(getTxPayloadKind({ NameRenew: { name: "alice", years: 3 } })).toBe("NameRenew");
    expect(getTxPayloadKind({ NameTransfer: { name: "alice", new_owner: bytes(TARGET) } })).toBe("NameTransfer");
    expect(getTxPayloadKind({ NameSetTarget: { name: "alice", target: bytes(TARGET) } })).toBe("NameSetTarget");
    expect(getTxPayloadKind({ NameSetPrimary: { name: "alice" } })).toBe("NameSetPrimary");
    expect(getTxPayloadKind({ NameRelease: { name: "alice" } })).toBe("NameRelease");
  });
});
