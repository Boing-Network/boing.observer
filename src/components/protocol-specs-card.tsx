import { describeProtocolSpecs } from "@/lib/protocol-specs";
import type { RpcProtocolSpecs } from "@/lib/rpc-types";

/** Read-only view of `method_catalog.protocol_specs` (priority tips, block signatures, ...). */
export function ProtocolSpecsCard({ specs }: { specs: RpcProtocolSpecs | null | undefined }) {
  const d = describeProtocolSpecs(specs);
  if (!d || d.sections.length === 0) return null;
  return (
    <section className="glass-card space-y-3 p-4 sm:p-6" aria-label="Protocol specs" data-testid="protocol-specs">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Protocol specs{d.version != null ? ` (v${d.version})` : ""}
      </h2>
      {d.note ? <p className="text-xs leading-relaxed text-[var(--text-muted)]">{d.note}</p> : null}
      <div className="space-y-2">
        {d.sections.map((s) => (
          <details key={s.name} className="rounded-lg border border-[var(--border-color)] px-3 py-2">
            <summary className="cursor-pointer font-mono text-sm text-network-cyan">{s.name}</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--text-secondary)]">
              {s.json}
            </pre>
          </details>
        ))}
      </div>
    </section>
  );
}