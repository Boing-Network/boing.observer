import type { AbiParam } from "./contract-interfaces";

/** 32-byte word, big-endian, from a decimal / 0x-hex integer (u8 / u64 / u128 / bool). */
function intWord(raw: string, maxBits: number): string {
  const s = raw.trim().toLowerCase();
  if (s === "true") return intWord("1", maxBits);
  if (s === "false") return intWord("0", maxBits);
  if (!/^(0x[0-9a-f]+|\d+)$/.test(s)) throw new Error(`"${raw}" is not a number`);
  const v = BigInt(s);
  if (v < BigInt(0) || v >= BigInt(1) << BigInt(maxBits)) throw new Error(`${raw} does not fit in ${maxBits} bits`);
  return v.toString(16).padStart(64, "0");
}

function hexWord(raw: string, label: string): string {
  const h = raw.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error(`${label} must be 32 bytes of hex (64 characters)`);
  return h;
}

export function encodeParamWord(p: AbiParam, raw: string): string {
  switch (p.type) {
    case "account":
      return hexWord(raw, p.name);
    case "bytes32":
      return hexWord(raw, p.name);
    case "u8":
      return intWord(raw, 8);
    case "u64":
      return intWord(raw, 64);
    case "bool":
      return intWord(raw, 1);
    default:
      return intWord(raw, 128);
  }
}

/** Reference layout: word 0 = selector in the low byte, then one 32-byte word per parameter. */
export function encodeContractCall(selector: number, params: AbiParam[], values: string[]): string {
  const head = selector.toString(16).padStart(64, "0");
  return `0x${head}${params.map((p, i) => encodeParamWord(p, values[i] ?? "")).join("")}`;
}

/** Split return data into 32-byte words (hex, no 0x). A trailing partial word is zero-padded on the right. */
export function returnWords(hex: string | null | undefined): string[] {
  const h = (hex ?? "").replace(/^0x/i, "").toLowerCase();
  const out: string[] = [];
  for (let i = 0; i < h.length; i += 64) out.push(h.slice(i, i + 64).padEnd(64, "0"));
  return out;
}

/** Word as an unsigned integer string when it fits in 128 bits, else null. */
export function wordAsUint(word: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(word)) return null;
  if (!/^0{32}/.test(word)) return null;
  return BigInt(`0x${word}`).toString();
}