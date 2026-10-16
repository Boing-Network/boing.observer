/**
 * Decode dispatch selectors from Boing VM bytecode.
 *
 * Boing templates load calldata word 0 and compare it against 32-byte words whose only non-zero byte is
 * the selector (low byte), then jump:
 *
 *   PUSHn <slot> MLOAD  PUSHn <selector word>  EQ  PUSHn <dest>  JUMPI
 *
 * (`Asm::mload(M_SEL).push(w_sel(s)).op(Eq).jumpi(label)` in `crates/boing-execution`). We look for that shape,
 * group candidates by the memory slot that was loaded, and keep the slot with the most comparisons (the
 * selector slot). Without any slot-grouped match we fall back to the bare `PUSH v EQ PUSH JUMPI` shape.
 */

const OP_EQ = 0x14;
const OP_ISZERO = 0x15;
const OP_AND = 0x16;
const OP_MSTORE = 0x52;
const OP_MLOAD = 0x51;
const OP_JUMPI = 0x57;
const OP_PUSH1 = 0x60;
const OP_PUSH32 = 0x7f;

export type Instr = { pc: number; op: number; arg?: Uint8Array };

export function disassemble(code: Uint8Array): Instr[] {
  const out: Instr[] = [];
  for (let pc = 0; pc < code.length; ) {
    const op = code[pc]!;
    if (op >= OP_PUSH1 && op <= OP_PUSH32) {
      const n = op - OP_PUSH1 + 1;
      out.push({ pc, op, arg: code.subarray(pc + 1, pc + 1 + n) });
      pc += 1 + n;
    } else {
      out.push({ pc, op });
      pc += 1;
    }
  }
  return out;
}

const isPush = (i: Instr | undefined): i is Instr & { arg: Uint8Array } =>
  !!i && i.op >= OP_PUSH1 && i.op <= OP_PUSH32 && !!i.arg;

/** Value of a push argument when it fits in one byte (all higher bytes zero), else null. */
function byteValue(arg: Uint8Array): number | null {
  for (let k = 0; k < arg.length - 1; k++) if (arg[k] !== 0) return null;
  return arg.length ? arg[arg.length - 1]! : null;
}

function bigValue(arg: Uint8Array): string {
  let s = "";
  for (const b of arg) s += b.toString(16).padStart(2, "0");
  return s.replace(/^0+/, "") || "0";
}

export function decodeDispatchSelectors(code: Uint8Array): number[] {
  const ins = disassemble(code);
  // Memory slots that hold the selector: calldata word 0 itself (memory 0), or a slot that received
  // `PUSH 0 MLOAD [PUSH 0xff AND] PUSH s MSTORE`.
  const selSlots = new Set<string>(["0"]);
  for (let i = 0; i + 3 < ins.length; i++) {
    const a = ins[i]!;
    if (!isPush(a) || bigValue(a.arg) !== "0" || ins[i + 1]!.op !== OP_MLOAD) continue;
    let j = i + 2;
    const m = ins[j];
    if (isPush(m) && byteValue(m.arg) === 0xff && ins[j + 1]?.op === OP_AND) j += 2;
    const s = ins[j];
    if (isPush(s) && ins[j + 1]?.op === OP_MSTORE) selSlots.add(bigValue(s.arg));
  }
  const loadsSel = (k: number) => {
    const load = ins[k];
    const slot = ins[k - 1];
    return load?.op === OP_MLOAD && isPush(slot) && selSlots.has(bigValue(slot.arg));
  };
  const found: number[] = [];
  for (let i = 1; i + 2 < ins.length; i++) {
    const eq = ins[i]!;
    if (eq.op !== OP_EQ) continue;
    let j = i + 1;
    if (ins[j]?.op === OP_ISZERO) j += 1;
    if (!isPush(ins[j]) || ins[j + 1]?.op !== OP_JUMPI) continue;
    // `<sel load> PUSH v EQ` or `PUSH v <sel load> EQ`
    const v1 = ins[i - 1];
    if (isPush(v1) && loadsSel(i - 2)) {
      const sel = byteValue(v1.arg);
      if (sel != null) found.push(sel);
      continue;
    }
    const v2 = ins[i - 3];
    if (loadsSel(i - 1) && isPush(v2)) {
      const sel = byteValue(v2.arg);
      if (sel != null) found.push(sel);
    }
  }
  return [...new Set(found)].sort((a, b) => a - b);
}
export function hexToBytesLoose(hex: string): Uint8Array {
  const h = hex.trim().replace(/^0x/i, "");
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error("invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}