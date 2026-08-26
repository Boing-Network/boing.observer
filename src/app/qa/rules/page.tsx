import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PdfDocument } from "@/components/pdf-document";
import { QA_DOC_URL, SITE_URL } from "@/lib/constants";
import { publicPdfSrc } from "@/lib/public-pdf";
import {
  CONTENT_BLOCKLIST_TERMS,
  EVALUATION_STEPS,
  HARD_RULES,
  OPCODES,
  QA_GATE_RULES_AS_OF,
  RPC_QA_ERRORS,
  SOFT_RULES,
  VALID_PURPOSE_CATEGORIES,
} from "@/lib/qa-gate-rules";

export const metadata: Metadata = {
  title: "QA gate rules",
  description:
    "Every protocol QA rule a Boing Network contract deploy must pass to be Allowed into a block — hard rejects, Unsure pool referrals, opcodes, content policy, and RPC codes.",
  openGraph: {
    title: "QA gate rules | Boing Observer",
    description:
      "Operational catalog of Allow / Reject / Unsure rules for Boing Network contract deployment.",
  },
  alternates: {
    canonical: `${SITE_URL}/qa/rules`,
  },
  keywords: ["Boing QA", "deployment rules", "quality assurance", "content policy", "Boing Network"],
};

function RuleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-boing-navy-mid/80 text-[var(--text-muted)]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--border-color)] align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--text-secondary)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QaGateRulesPage() {
  const pdfSrc = publicPdfSrc("QA-GATE-RULES.pdf");

  return (
    <article className="mx-auto max-w-4xl space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/qa" className="text-network-cyan hover:underline">
              QA
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">Gate rules</li>
        </ol>
      </nav>

      <header>
        <h1 className="page-title font-display">QA gate rules</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-[var(--text-secondary)]">
          Every automated rule a contract deploy must satisfy before it can be{" "}
          <strong className="text-[var(--text-primary)]">Allowed</strong> into a block. Source: protocol crate{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing-qa</code> as of {QA_GATE_RULES_AS_OF}.
          List contents (hashes, patterns, terms) are governance-mutable; rule IDs and matching logic are code.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Pre-flight:{" "}
          <Link href="/tools/qa-check" className="text-network-cyan hover:underline">
            QA check
          </Link>
          {" · "}
          Live queue:{" "}
          <Link href="/qa" className="text-network-cyan hover:underline">
            QA transparency
          </Link>
          {" · "}
          Design spec:{" "}
          <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            QUALITY-ASSURANCE-NETWORK.md
          </a>
        </p>
      </header>

      <PdfDocument src={pdfSrc} title="QA gate rules" fileName="QA-GATE-RULES.pdf" />

      <section className="glass-card border-amber-500/30 bg-amber-950/15 p-4 sm:p-5" aria-labelledby="live-heading">
        <h2 id="live-heading" className="font-display text-lg font-semibold text-amber-100">
          Live public testnet vs intended policy
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          On {QA_GATE_RULES_AS_OF}, <code className="rounded bg-white/10 px-1 text-xs">boing_getQaRegistry</code> at
          the public testnet RPC returned empty <code className="rounded bg-white/10 px-1 text-xs">blocklist</code>,{" "}
          <code className="rounded bg-white/10 px-1 text-xs">scam_patterns</code>,{" "}
          <code className="rounded bg-white/10 px-1 text-xs">always_review_categories</code>, and{" "}
          <code className="rounded bg-white/10 px-1 text-xs">content_blocklist</code>, with max bytecode{" "}
          <strong className="text-[var(--text-primary)]">32,768</strong> bytes. The intended public-testnet policy
          merges {CONTENT_BLOCKLIST_TERMS.length} English terms into the content blocklist. Those terms do not reject
          until the live registry contains them. Always trust the RPC you submit to.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="outcomes-heading">
        <h2 id="outcomes-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Outcomes
        </h2>
        <RuleTable
          headers={["Outcome", "RPC", "Meaning"]}
          rows={[
            [
              <strong key="a" className="text-emerald-300">
                Allow
              </strong>,
              "submit succeeds",
              "Eligible for inclusion in a block.",
            ],
            [
              <strong key="r" className="text-red-300">
                Reject
              </strong>,
              <code key="c" className="rounded bg-white/10 px-1 text-xs">
                -32050
              </code>,
              "Never enters a block. Response includes rule_id and message.",
            ],
            [
              <strong key="u" className="text-amber-200">
                Unsure
              </strong>,
              <code key="c2" className="rounded bg-white/10 px-1 text-xs">
                -32051
              </code>,
              "Referred to the community QA pool. Not auto-included.",
            ],
          ]}
        />
      </section>

      <section className="space-y-3" aria-labelledby="order-heading">
        <h2 id="order-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Evaluation order
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          First match wins in <code className="rounded bg-white/10 px-1 text-xs">check_contract_deploy_full_with_metadata</code>.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
          {EVALUATION_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3" aria-labelledby="hard-heading">
        <h2 id="hard-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Hard rules (Reject)
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Necessary for Allow, not always sufficient — Unsure can still fire after these pass.
        </p>
        <RuleTable
          headers={["ID", "rule_id", "Rule", "If it fails"]}
          rows={HARD_RULES.map((r) => [
            r.id,
            <code key={r.id} className="rounded bg-white/10 px-1 text-xs">
              {r.ruleId}
            </code>,
            <span key={`${r.id}-t`}>
              <strong className="text-[var(--text-primary)]">{r.title}.</strong> {r.summary}
            </span>,
            r.outcome,
          ])}
        />
      </section>

      <section className="space-y-3" aria-labelledby="purpose-heading">
        <h2 id="purpose-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Valid purpose categories
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Matching is case-insensitive. Missing purpose is allowed. Meme, community, and entertainment are first-class
          — “no traditional utility” is not a reject.
        </p>
        <ul className="flex flex-wrap gap-2">
          {VALID_PURPOSE_CATEGORIES.map((c) => (
            <li
              key={c}
              className="rounded-full border border-[var(--border-color)] bg-boing-navy-mid/60 px-3 py-1 text-sm text-[var(--text-primary)]"
            >
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="op-heading">
        <h2 id="op-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Allowed opcodes
        </h2>
        <p className="text-sm text-[var(--text-muted)]">Any other opcode byte is INVALID_OPCODE. PUSH immediates are not whitelist-checked.</p>
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-boing-navy-mid/80 text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Byte</th>
                <th className="px-3 py-2 font-medium">Name</th>
              </tr>
            </thead>
            <tbody>
              {OPCODES.map((op) => (
                <tr key={op.byte} className="border-t border-[var(--border-color)]">
                  <td className="px-3 py-1.5 font-mono text-xs text-network-cyan">{op.byte}</td>
                  <td className="px-3 py-1.5 text-[var(--text-secondary)]">{op.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="soft-heading">
        <h2 id="soft-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Soft / policy rules (Unsure)
        </h2>
        <RuleTable
          headers={["ID", "Rule", "Outcome"]}
          rows={SOFT_RULES.map((r) => [
            r.id,
            <span key={r.id}>
              <strong className="text-[var(--text-primary)]">{r.title}.</strong> {r.summary}
            </span>,
            r.outcome,
          ])}
        />
      </section>

      <section className="space-y-3" aria-labelledby="content-heading">
        <h2 id="content-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Content-policy matching
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Empty blocklist → skip. Names are trimmed and lowercased.</li>
          <li>Terms with spaces or punctuation: substring match (e.g. “kill yourself”).</li>
          <li>Alphanumeric terms of length ≥ 4: substring match (e.g. “shit” matches “ShitCoin”).</li>
          <li>Alphanumeric terms shorter than 4: whole-token match only (“ass” does not match “Classic”).</li>
        </ol>
        <p className="text-sm text-[var(--text-muted)]">
          Content policy does not scan bytecode, purpose text, or off-chain URIs. It only sees deploy-time{" "}
          <code className="rounded bg-white/10 px-1 text-xs">asset_name</code> /{" "}
          <code className="rounded bg-white/10 px-1 text-xs">asset_symbol</code>.
        </p>
        <details className="glass-card p-4">
          <summary className="cursor-pointer font-display text-sm font-semibold text-[var(--text-primary)]">
            Intended English content blocklist ({CONTENT_BLOCKLIST_TERMS.length} terms)
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
            {CONTENT_BLOCKLIST_TERMS.join(", ")}.
          </p>
        </details>
      </section>

      <section className="space-y-3" aria-labelledby="allow-heading">
        <h2 id="allow-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          What is required for Allow
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Every applicable hard rule R1–R10 passes.</li>
          <li>Purpose is omitted, empty, or a valid category.</li>
          <li>Purpose is not in the always-review set.</li>
          <li>If purpose is other, description_hash is at least 4 bytes.</li>
        </ul>
        <p className="text-sm text-[var(--text-muted)]">
          Not required: traditional utility, jump-target proofs, token/NFT ABI layout, off-chain websites, or vulgarity
          inside bytecode.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="pool-heading">
        <h2 id="pool-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Community pool (Unsure)
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Anyone with a 32-byte account may vote Allow, Reject, or Abstain (live public testnet has open voting). The
          deployer cannot vote on their own item. Counted votes are Allow+Reject; 2/3 of those decide after quorum.
          Default on the 7-day window expiry is <strong className="text-[var(--text-primary)]">reject</strong>. Pool
          voters should reject scams, phishing, rug-pulls, malware, impersonation, deceptive naming, Ponzi patterns, and
          spam — not memes or experimental work.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="rpc-heading">
        <h2 id="rpc-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          QA RPC error codes
        </h2>
        <RuleTable
          headers={["Code", "Meaning"]}
          rows={RPC_QA_ERRORS.map((row) => [
            <code key={row.code} className="rounded bg-white/10 px-1 text-xs">
              {row.code}
            </code>,
            row.summary,
          ])}
        />
      </section>
    </article>
  );
}
