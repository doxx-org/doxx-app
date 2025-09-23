import { BN } from "@coral-xyz/anchor";

export function parseDecimalsInput(value: string): string {
  // ✅ Disallow leading zeros (unless '0' or '0.xxx' or '.xxx')
  if (/^0\d+/.test(value)) {
    value = value.replace(/^0+/, ""); // Remove leading zeros
  }

  // ✅ Match decimal numbers only
  const regex = /^(0|[1-9]\d*)(\.\d*)?$|^(\.\d+)?$/;

  if (regex.test(value)) {
    return value;
  }

  return "0";
}

export function toBN(v: BN | number | string) {
  return BN.isBN(v) ? (v as BN) : new BN(v);
}
