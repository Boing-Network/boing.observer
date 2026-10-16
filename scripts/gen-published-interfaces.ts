/**
 * Generate the canonical testnet interface JSONs published in the on-chain interface registry.
 * Functions = the observer's template for the contract, filtered to the selectors its live bytecode dispatches on.
 *
 *   npx vite-node scripts/gen-published-interfaces.ts -- <outDir> [rpcUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { identifyContract } from "../src/lib/contract-identify";

const PUBLISH = [
  "6676f971ade3982406efa3e2cdb0477923f8f2a15624c4b6ad3a432817a75e93", // USDC
  "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61", // v9 pool
  "806b2462b28f2f5772bbf5ae2628ad3a333bd2c5fa341144e0400ef5c2f1e4c6", // custody router
  "236a851dd50faaa268e2e1b7ba95cfb9993773abf63a4c0d949183d8302e65c7", // LP vault v2
];

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const outDir = args[0];
  const rpcUrl = args[1] ?? "https://boing-testnet-1.fly.dev";
  if (!outDir) throw new Error("usage: gen-published-interfaces.ts <outDir> [rpcUrl]");
  mkdirSync(outDir, { recursive: true });
  for (const addr of PUBLISH) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "boing_getContractCode", params: [`0x${addr}`] }),
    });
    const j = (await res.json()) as { result?: { bytecode: string } | null };
    if (!j.result) throw new Error(`no code for ${addr}`);
    const id = identifyContract({
      network: "testnet",
      address64: addr,
      code: { bytecodeHex: j.result.bytecode, deployer: null, height: null, txIndex: null },
    });
    const doc = {
      schema: "boing-interface/v1",
      network: "boing-testnet",
      contract: `0x${addr}`,
      name: id.label,
      interfaceId: id.interfaceId,
      summary: id.summary,
      docsUrl: id.docsUrl,
      functions: id.functions.map((f) => ({
        selector: f.selector,
        name: f.name,
        params: f.params,
        kind: f.kind,
        description: f.description,
        access: f.access,
        ...(f.returns ? { returns: f.returns } : {}),
      })),
    };
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    writeFileSync(join(outDir, `0x${addr}.json`), text.replace(/\r\n/g, "\n"));
    console.log(`0x${addr}  ${doc.functions.length} functions  ${id.label}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});