import { blake3 } from "@noble/hashes/blake3";
import { describe, expect, it } from "vitest";
import { applyPublishedInterface, identifyContract } from "./contract-identify";
import {
  TESTNET_INTERFACE_REGISTRY,
  bytesToHex,
  claimerKey,
  fieldKey,
  nonceDerivedAddress,
  resolvePublishedInterface,
} from "./published-interface";

const DEPLOYER = "8079f30559c02c5fe087c9ad1bc3b751a29de35992f3f8431734243e825f696e";
const OTHER = "11".repeat(32);
const CONTRACT = nonceDerivedAddress(DEPLOYER, 7);
const JSON_TEXT = `${JSON.stringify({
  schema: "boing-interface/v1",
  name: "My pool",
  summary: "A published pool",
  functions: [{ selector: 16, name: "swap_exact", params: [{ name: "direction", type: "u128" }], kind: "write", description: "d", access: "anyone" }],
}, null, 2)}\n`;
const URI = "https://boing.network/interfaces/testnet/x.json";

function makeRpc(opts: { claimer: string; hash?: string; nonce?: number }) {
  const store = new Map<string, string>();
  const word = (b: Uint8Array) => {
    const w = new Uint8Array(32);
    w.set(b);
    return bytesToHex(w);
  };
  const hash = opts.hash ?? bytesToHex(blake3(new TextEncoder().encode(JSON_TEXT)));
  store.set(claimerKey(CONTRACT), opts.claimer);
  store.set(fieldKey(CONTRACT, 8), opts.claimer);
  store.set(fieldKey(CONTRACT, 0), hash);
  const u = new TextEncoder().encode(URI);
  const len = new Uint8Array(32);
  len[31] = u.length;
  store.set(fieldKey(CONTRACT, 1), bytesToHex(len));
  for (let i = 0; i * 32 < u.length; i++) store.set(fieldKey(CONTRACT, 2 + i), word(u.slice(i * 32, i * 32 + 32)));
  return async <T,>(method: string, params: unknown[]): Promise<T> => {
    if (method === "boing_getContractStorage") {
      expect(params[0]).toBe(`0x${TESTNET_INTERFACE_REGISTRY}`);
      const key = String(params[1]).slice(2);
      return { value: `0x${store.get(key) ?? "0".repeat(64)}` } as T;
    }
    if (method === "boing_getAccount") return { nonce: opts.nonce ?? 20 } as T;
    throw new Error(method);
  };
}

const fetcher = (text: string) => async () => ({ ok: true, status: 200, bytes: new TextEncoder().encode(text) });

describe("published interfaces", () => {
  it("verifies claimer = deployer (nonce-derived) and the hash, then overrides names", async () => {
    const pub = await resolvePublishedInterface(makeRpc({ claimer: DEPLOYER }), CONTRACT, { fetcher: fetcher(JSON_TEXT) });
    expect(pub?.verified).toBe(true);
    expect(pub?.uri).toBe(URI);
    const id = applyPublishedInterface(identifyContract({ network: "testnet", address64: CONTRACT, code: null }), pub);
    expect(id.source).toBe("published");
    expect(id.label).toBe("My pool");
    expect(id.functions.map((f) => f.name)).toEqual(["swap_exact"]);
    expect(id.published?.verified).toBe(true);
  });

  it("accepts a deployer proven by history even past the nonce scan", async () => {
    const pub = await resolvePublishedInterface(makeRpc({ claimer: DEPLOYER, nonce: 0 }), CONTRACT, {
      fetcher: fetcher(JSON_TEXT),
      knownDeployer: `0x${DEPLOYER}`,
    });
    expect(pub?.verified).toBe(true);
  });

  it("ignores a record claimed by someone who did not deploy the contract", async () => {
    const pub = await resolvePublishedInterface(makeRpc({ claimer: OTHER }), CONTRACT, { fetcher: fetcher(JSON_TEXT) });
    expect(pub?.verified).toBe(false);
    expect(pub?.deployerVerified).toBe(false);
    const id = applyPublishedInterface(identifyContract({ network: "testnet", address64: CONTRACT, code: null }), pub);
    expect(id.source).toBe("none");
    expect(id.notes.join(" ")).toMatch(/not the contract's deployer/);
  });

  it("ignores a record whose file does not match the hash", async () => {
    const pub = await resolvePublishedInterface(makeRpc({ claimer: DEPLOYER }), CONTRACT, { fetcher: fetcher(JSON_TEXT + " ") });
    expect(pub?.verified).toBe(false);
    expect(pub?.hashVerified).toBe(false);
  });

  it("returns null when nothing is published", async () => {
    const rpc = async <T,>(method: string): Promise<T> =>
      (method === "boing_getContractStorage" ? { value: `0x${"0".repeat(64)}` } : { nonce: 0 }) as T;
    expect(await resolvePublishedInterface(rpc, CONTRACT)).toBeNull();
  });
});

describe("built-in hosting (boing://iface-blob/)", () => {
  it("reads the deflated JSON from the blob store, verifies the hash and marks hosting=boing", async () => {
    const zlib = await import("node:zlib");
    const { blobKey, TESTNET_INTERFACE_BLOB_STORE } = await import("./published-interface");
    const json = new TextEncoder().encode(JSON_TEXT);
    const hash = bytesToHex(blake3(json));
    const id = BigInt(`0x${hash.slice(0, 16)}`);
    const uri = `boing://iface-blob/0x${DEPLOYER}/${hash.slice(0, 16)}`;
    const stored = new Uint8Array(zlib.deflateRawSync(json));
    const blob = new Map<string, string>();
    const header = new Uint8Array(32);
    header.set(new TextEncoder().encode("BIF1"));
    header[4] = 1;
    header[30] = stored.length >> 8;
    header[31] = stored.length & 0xff;
    blob.set(blobKey(DEPLOYER, id, 0), bytesToHex(header));
    for (let i = 0; i * 32 < stored.length; i++) {
      const w = new Uint8Array(32);
      w.set(stored.slice(i * 32, i * 32 + 32));
      blob.set(blobKey(DEPLOYER, id, i + 1), bytesToHex(w));
    }
    const reg = new Map<string, string>();
    reg.set(claimerKey(CONTRACT), DEPLOYER);
    reg.set(fieldKey(CONTRACT, 8), DEPLOYER);
    reg.set(fieldKey(CONTRACT, 0), hash);
    const u = new TextEncoder().encode(uri);
    const len = new Uint8Array(32);
    len[31] = u.length;
    reg.set(fieldKey(CONTRACT, 1), bytesToHex(len));
    for (let i = 0; i * 32 < u.length; i++) {
      const w = new Uint8Array(32);
      w.set(u.slice(i * 32, i * 32 + 32));
      reg.set(fieldKey(CONTRACT, 2 + i), bytesToHex(w));
    }
    const rpc = async <T,>(method: string, params: unknown[]): Promise<T> => {
      if (method === "boing_getContractStorage") {
        const map = params[0] === `0x${TESTNET_INTERFACE_BLOB_STORE}` ? blob : reg;
        return { value: `0x${map.get(String(params[1]).slice(2)) ?? "0".repeat(64)}` } as T;
      }
      if (method === "boing_getAccount") return { nonce: 20 } as T;
      throw new Error(method);
    };
    const pub = await resolvePublishedInterface(rpc, CONTRACT, { fetcher: async () => { throw new Error("must not fetch"); } });
    expect(pub?.verified).toBe(true);
    expect(pub?.hosting).toBe("boing");
    expect(pub?.doc?.name).toBe("My pool");
    // tampered blob -> hash mismatch, not verified
    blob.set(blobKey(DEPLOYER, id, 1), "ff".repeat(32));
    const bad = await resolvePublishedInterface(rpc, CONTRACT, {});
    expect(bad?.verified).toBe(false);
  });
});
