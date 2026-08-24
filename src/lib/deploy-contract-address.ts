import {
  ensureHex,
  hexToBytes,
  predictCreate2ContractAddress,
  predictNonceDerivedContractAddress,
  validateHex32,
} from "boing-sdk";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";
import { getTxPayloadInner, getTxPayloadKind, isContractDeployPayloadKind } from "@/lib/tx-payload";

function bytecodeToBytes(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.every((x) => typeof x === "number")) {
    return Uint8Array.from(raw as number[]);
  }
  if (typeof raw === "string") {
    try {
      return hexToBytes(ensureHex(raw.trim()));
    } catch {
      return null;
    }
  }
  return null;
}

function parseTxNonce(raw: unknown): bigint | null {
  if (typeof raw === "bigint" && raw >= BigInt(0)) return raw;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && Number.isSafeInteger(raw)) {
    return BigInt(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    try {
      return BigInt(raw.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function parseCreate2Salt(inner: Record<string, unknown>): Uint8Array | null {
  const s = inner.create2_salt;
  if (s == null) return null;
  if (Array.isArray(s) && s.length === 32 && s.every((x) => typeof x === "number")) {
    return Uint8Array.from(s as number[]);
  }
  if (typeof s === "string") {
    try {
      const b = hexToBytes(ensureHex(s.trim()));
      return b.length === 32 ? b : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Derives the deployed contract AccountId (64 hex, no 0x) using the same rules as `boing_execution::Vm`:
 * CREATE2 when `create2_salt` is set, otherwise BLAKE3(sender ‖ nonce u64 LE).
 *
 * Boing receipts currently omit `return_data` on successful deploys (`return_data: "0x"`), so the token
 * index must not rely on receipt bytes alone.
 */
export function tryPredictDeployedContractAddressFromDeployTx(
  tx: { sender?: unknown; nonce?: unknown; payload?: unknown },
  payload: unknown
): string | null {
  const kind = getTxPayloadKind(payload);
  if (!isContractDeployPayloadKind(kind)) return null;
  const inner = getTxPayloadInner(payload);
  const bc = bytecodeToBytes(inner.bytecode);
  if (!bc || bc.length === 0) return null;

  const sender64 = hexForLink(tx.sender);
  if (!sender64 || sender64.length !== 64) return null;
  const nonce = parseTxNonce(tx.nonce);
  if (nonce == null) return null;

  try {
    const senderHex = validateHex32(`0x${sender64}`);
    const salt = parseCreate2Salt(inner);
    const predicted = salt
      ? predictCreate2ContractAddress(senderHex, salt, bc)
      : predictNonceDerivedContractAddress(senderHex, nonce);
    const raw = predicted.replace(/^0x/i, "");
    return normalizeHex64(raw);
  } catch {
    return null;
  }
}
