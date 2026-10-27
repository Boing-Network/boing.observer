import { describe, expect, it } from "vitest";
import { extractBodies, formatSummary, parseReport, summarize } from "./csp-report-summary.mjs";

const line = (body) => `[csp-report] ${body}`;
const legacy = (directive, blocked, doc) =>
  JSON.stringify({ "csp-report": { "effective-directive": directive, "blocked-uri": blocked, "document-uri": doc } });

describe("csp-report-summary", () => {
  it("extracts bodies from wrangler JSON, pretty and bare lines", () => {
    const a = legacy("script-src-elem", "https://evil.example/x.js", "https://observer.test/");
    const text = [
      JSON.stringify({ logs: [{ level: "warn", message: ["[csp-report]", a] }, { message: ["other", "x"] }] }),
      `  (warn) [csp-report] ${a}`,
      `[csp-report] ${a}`,
      "unrelated line",
    ].join("\n");
    expect(extractBodies(text)).toEqual([a, a, a]);
  });

  it("parses both report shapes and rejects junk", () => {
    expect(parseReport(legacy("img-src", "data:image/png;base64,AAAA", "https://o.test/tokens?x=1"))).toEqual({
      directive: "img-src",
      blocked: "data:",
      page: "/tokens",
    });
    const api = JSON.stringify([
      { type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline", documentURL: "https://o.test/a/b" } },
    ]);
    expect(parseReport(api)).toEqual({ directive: "script-src", blocked: "inline", page: "/a/b" });
    expect(parseReport("not json")).toBeNull();
    expect(parseReport("{}")).toBeNull();
  });

  it("groups, counts and excludes without hiding the excluded count", () => {
    const text = [
      line(legacy("script-src-elem", "https://evil.example/x.js", "https://o.test/")),
      line(legacy("script-src-elem", "https://evil.example/y.js", "https://o.test/tokens")),
      line(legacy("img-src", "http://cdn.test/a.png", "https://o.test/")),
      line(legacy("script-src", "smoke-test", "https://o.test/smoke-test")),
      "[csp-report] garbage",
    ].join("\n");
    const s = summarize(text, { exclude: ["smoke-test"] });
    expect(s.total).toBe(3);
    expect(s.excluded).toBe(1);
    expect(s.unparsable).toBe(1);
    expect(s.rows[0]).toMatchObject({ directive: "script-src-elem", blocked: "https://evil.example", count: 2 });
    expect(formatSummary(s)).toContain("3 counted, 1 excluded, 1 unparsable");
    expect(summarize(text).total).toBe(4);
  });

  it("handles empty input", () => {
    expect(formatSummary(summarize(""))).toContain("(no violations found)");
  });
});