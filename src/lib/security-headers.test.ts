import { describe, expect, it } from "vitest";
import { PDF_HEADERS, SECURITY_HEADERS } from "../../security-headers.mjs";

const get = (list: Array<{ key: string; value: string }>, key: string) =>
  list.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe("security headers", () => {
  it("sets the baseline set", () => {
    expect(get(SECURITY_HEADERS, "x-content-type-options")).toBe("nosniff");
    expect(get(SECURITY_HEADERS, "x-frame-options")).toBe("DENY");
    expect(get(SECURITY_HEADERS, "referrer-policy")).toBeTruthy();
    expect(get(SECURITY_HEADERS, "permissions-policy")).toContain("camera=()");
    expect(get(SECURITY_HEADERS, "strict-transport-security")).toMatch(/max-age=\d+/);
  });

  it("CSP never relaxes script-src (not set) and forbids plugins and foreign framing", () => {
    const csp = get(SECURITY_HEADERS, "content-security-policy")!;
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe");
  });

  it("allows only same-origin framing for PDFs", () => {
    expect(get(PDF_HEADERS, "x-frame-options")).toBe("SAMEORIGIN");
    expect(get(PDF_HEADERS, "content-security-policy")).toBe("frame-ancestors 'self'");
  });
});
