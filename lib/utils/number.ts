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

export function toBN(v: BN | number | string): BN {
  return BN.isBN(v) ? (v as BN) : new BN(v);
}

export function toBNWithDecimals(
  v: BN | number | string,
  decimals: number,
): BN {
  return toBN(v).mul(toBN(10 ** decimals));
}

export function parseAmountBN(
  stringAmount: string,
  decimals: number,
): BN {
  const [integerPart, fractionalPart = ""] = stringAmount.split(".");
  const normalizedFractionalPart = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const combined = integerPart + normalizedFractionalPart;
  return new BN(combined);
}