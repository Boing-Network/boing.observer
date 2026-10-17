import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

import { TransactionInsight } from "./transaction-insight";
import type { TransactionReceipt } from "@/lib/rpc-types";

const sender = "af".repeat(32);
const to = "42".repeat(32);
const tx = { sender, payload: { Transfer: { to, amount: "1000000000000000000000000000000" } } };
const failed = { tx_id: "0x" + "ee".repeat(32), block_height: 925, success: false, gas_used: 21000, error: "Insufficient balance" } as unknown as TransactionReceipt;
const ok = { ...failed, success: true, error: null } as unknown as TransactionReceipt;

function render(receipt: TransactionReceipt, featured: boolean) {
  return renderToStaticMarkup(
    <TransactionInsight
      tx={tx as never}
      network="testnet"
      receipt={receipt}
      receiptsWereRequested
      visualScale={featured ? "featured" : "standard"}
      index={0}
    />,
  );
}

describe("TransactionInsight failed transfer", () => {
  it("featured: says not transferred, strikes the amount, shows the fee and reverted wording", () => {
    const html = render(failed, true);
    expect(html).toContain("Not transferred (failed)");
    expect(html).toContain("line-through");
    expect(html).toContain("1.0e30");
    expect(html).toContain('title="1,000,000,000,000,000,000,000,000,000,000 BOING"');
    expect(html).toMatch(/fee only|fee \(1 BOING\)/);
    expect(html).toContain("attempted but reverted");
    expect(html).not.toContain("Amount transferred");
  });
  it("standard: Value flow labels it failed", () => {
    expect(render(failed, false)).toContain("Value flow: not transferred (failed)");
  });
  it("successful transfer keeps the normal wording", () => {
    const html = render(ok, true);
    expect(html).toContain("Amount transferred");
    expect(html).not.toContain("attempted but reverted");
  });
});
