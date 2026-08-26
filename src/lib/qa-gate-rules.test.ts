import { describe, expect, it } from "vitest";
import { CONTENT_BLOCKLIST_TERMS, HARD_RULES, OPCODES } from "./qa-gate-rules";

describe("qa-gate-rules catalog", () => {
  it("lists ten hard rules and the intended 132-term English blocklist", () => {
    expect(HARD_RULES).toHaveLength(10);
    expect(CONTENT_BLOCKLIST_TERMS).toHaveLength(132);
    expect(new Set(CONTENT_BLOCKLIST_TERMS).size).toBe(132);
  });

  it("includes CREATE2 and the PUSH range in the opcode whitelist", () => {
    expect(OPCODES.some((op) => op.name === "CREATE2")).toBe(true);
    expect(OPCODES.some((op) => op.byte === "0x60–0x7F")).toBe(true);
  });
});
