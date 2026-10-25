import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, generateNonce, parseCspMode } from "./csp";

describe("csp", () => {
  it("parses modes with report-only as the default", () => {
    expect(parseCspMode(undefined)).toBe("report-only");
    expect(parseCspMode("garbage")).toBe("report-only");
    expect(parseCspMode("off")).toBe("off");
    expect(parseCspMode("NONCE-ENFORCE")).toBe("nonce-enforce");
  });
  it("generates distinct base64 nonces", () => {
    const a = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(generateNonce()).not.toBe(a);
  });
  it("builds a nonce + strict-dynamic policy without unsafe-inline scripts", () => {
    const csp = buildCsp("nonce-report-only", "abc")!;
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
  });
  it("report-only baseline allows inline scripts for prerendered pages", () => {
    expect(buildCsp("report-only", "x")).toMatch(/script-src[^;]*unsafe-inline/);
  });
  it("maps header names; off emits nothing", () => {
    expect(buildCsp("off", "x")).toBeNull();
    expect(cspHeaderName("off")).toBeNull();
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("nonce-enforce")).toBe("Content-Security-Policy");
  });
});