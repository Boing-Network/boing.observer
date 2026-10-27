#!/usr/bin/env node
/**
 * Summarize `/api/csp-report` log lines.
 *
 * The route (`src/app/api/csp-report/route.ts`) only logs `console.warn("[csp-report]", <body>)`; nothing is stored.
 * Capture lines with `npx wrangler tail boing-observer --format json > csp.log` (or pretty format, or a Workers Logs
 * export), then:
 *
 *   node scripts/csp-report-summary.mjs csp.log
 *   node scripts/csp-report-summary.mjs --json --exclude smoke-test < csp.log
 *
 * `--exclude <text>` (repeatable) drops reports whose raw body contains the text (for example the synthetic
 * "smoke-test" report posted after a deploy). Excluded reports are counted separately, never hidden silently.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MARKER = "[csp-report]";

/** Bodies logged by the route, found in `wrangler tail` JSON, pretty text, or bare lines. */
export function extractBodies(text) {
  const bodies = [];
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("{") && trimmed.includes(MARKER)) {
      try {
        const evt = JSON.parse(trimmed);
        for (const l of Array.isArray(evt.logs) ? evt.logs : []) {
          const m = Array.isArray(l.message) ? l.message : [l.message];
          if (m[0] === MARKER && typeof m[1] === "string") bodies.push(m[1]);
        }
        continue;
      } catch {
        // not a wrangler JSON event: fall through to the plain-text scan
      }
    }
    const i = trimmed.indexOf(MARKER);
    if (i >= 0) bodies.push(trimmed.slice(i + MARKER.length).trim());
  }
  return bodies;
}

function originOrKeyword(value) {
  if (typeof value !== "string" || !value) return "(none)";
  try {
    const u = new URL(value);
    return u.protocol === "data:" || u.protocol === "blob:" ? u.protocol : u.origin;
  } catch {
    return value; // keywords such as "inline" / "eval" / "self"
  }
}

function pathOf(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return "(unknown)";
  }
}

/** Normalize the legacy `{"csp-report": {...}}` and the Reporting API `[{type, body}]` shapes. */
export function parseReport(body) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const first = Array.isArray(json) ? json[0] : json;
  const r = first?.["csp-report"] ?? first?.body ?? null;
  if (!r || typeof r !== "object") return null;
  const directive = r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? r.violatedDirective;
  return {
    directive: typeof directive === "string" ? directive.split(" ")[0] : "(unknown)",
    blocked: originOrKeyword(r["blocked-uri"] ?? r.blockedURL ?? r.blockedUri),
    page: pathOf(r["document-uri"] ?? r.documentURL ?? r.documentUri),
  };
}

/** @param {string} text raw log text  @param {{exclude?: string[]}} [opts] */
export function summarize(text, opts = {}) {
  const exclude = (opts.exclude ?? []).filter(Boolean);
  const groups = new Map();
  let total = 0;
  let excluded = 0;
  let unparsable = 0;
  for (const body of extractBodies(text)) {
    if (exclude.some((x) => body.includes(x))) {
      excluded += 1;
      continue;
    }
    const rep = parseReport(body);
    if (!rep) {
      unparsable += 1;
      continue;
    }
    total += 1;
    const key = `${rep.directive}\u0000${rep.blocked}`;
    const g = groups.get(key) ?? { directive: rep.directive, blocked: rep.blocked, count: 0, pages: new Map() };
    g.count += 1;
    g.pages.set(rep.page, (g.pages.get(rep.page) ?? 0) + 1);
    groups.set(key, g);
  }
  const rows = [...groups.values()]
    .map((g) => ({
      directive: g.directive,
      blocked: g.blocked,
      count: g.count,
      pages: [...g.pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p),
    }))
    .sort((a, b) => b.count - a.count || a.directive.localeCompare(b.directive) || a.blocked.localeCompare(b.blocked));
  return { total, excluded, unparsable, rows };
}

export function formatSummary(s) {
  const out = [`CSP reports: ${s.total} counted, ${s.excluded} excluded, ${s.unparsable} unparsable`];
  for (const r of s.rows) out.push(`${String(r.count).padStart(5)}  ${r.directive}  blocked=${r.blocked}  pages=${r.pages.join(", ")}`);
  if (s.rows.length === 0) out.push("  (no violations found)");
  return out.join("\n");
}

function main(argv) {
  const exclude = [];
  let json = false;
  let file = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") json = true;
    else if (argv[i] === "--exclude") exclude.push(argv[++i]);
    else file = argv[i];
  }
  const text = readFileSync(file ?? 0, "utf8");
  const s = summarize(text, { exclude });
  console.log(json ? JSON.stringify(s, null, 2) : formatSummary(s));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));