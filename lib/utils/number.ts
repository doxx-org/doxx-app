import { BN } from "@coral-xyz/anchor";
import { MINIMUM_CAP_E9, ONE_MILLION_E9 } from "../constants";

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

export function parseAmountBN(stringAmount: string, decimals: number): BN {
  const [integerPart, fractionalPart = ""] = stringAmount.split(".");
  const normalizedFractionalPart = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);
  const combined = integerPart + normalizedFractionalPart;
  return new BN(combined);
}

interface FormatAmountBNOptions {
  displayDecimals?: number;
}

// format amount to human readable format
// e.g. formatAmountBN(1e9, 9) -> "1"
//      formatAmountBN(0.1e9, 9) -> "0.1"
//      formatAmountBN(0.11111e9, 9) -> "0.11111"
//      formatAmountBN(0.11111e9, 9, { displayDecimals: 2 }) -> "0.11"
function formatAmountBN(
  amount: BN,
  decimals: number,
  options?: FormatAmountBNOptions,
): string {
  if (decimals === 0) return amount.toString(10);

  const base = new BN(10).pow(new BN(decimals)); // 10^decimals (as BN)
  const isNeg = amount.isNeg();
  const abs = amount.abs();

  const integer = abs.div(base).toString(10);
  let fraction = abs.mod(base).toString(10).padStart(decimals, "0");

  // Trim trailing zeros in the fractional part
  fraction = fraction.replace(/0+$/, "");

  // Cut off till displayDecimals
  if (options?.displayDecimals) {
    fraction = fraction.slice(0, options.displayDecimals);
  }

  // Build the result
  const result = fraction.length > 0 ? `${integer}.${fraction}` : integer;
  return isNeg ? `-${result}` : result;
}

// normalize bps string to human readable format
// e.g. "1000" -> "0.1"
//      = 1000 / 10000 = 0.1
export function normalizeBPSString(bpsString: string): string {
  return normalizeBN(parseAmountBN(bpsString, 2), 4, {
    minCap: parseAmountBN("0.01", 4),
  });
}

interface NormalizeBNOptions extends FormatAmountBNOptions {
  minCap?: BN;
  maxCap?: BN;
}

// normalize amount to human readable format
// e.g. normalizeBN(1e9, 9) -> "1"
//      normalizeBN(0.1e9, 9) -> "0.1"
//      normalizeBN(0.11111e9, 9) -> "0.11111"
//      normalizeBN(0.11111e9, 9, { displayDecimals: 2 }) -> "0.11"
//      normalizeBN(0.009e9, 9, { minCap: parseAmountBN("0.01", 9) }) -> "<0.01"
//      normalizeBN(1000001e9, 9, { maxCap: parseAmountBN("1000000", 9) }) -> ">1000000"
export function normalizeBN(
  amount: BN,
  decimals: number,
  {
    displayDecimals = decimals,
    minCap = MINIMUM_CAP_E9,
    maxCap = ONE_MILLION_E9,
  }: NormalizeBNOptions = {},
): string {
  // Convert to string and pad with zeros if needed
  try {
    if (amount.lt(minCap)) {
      return "<" + formatAmountBN(minCap, decimals);
    }
    if (amount.gt(maxCap)) {
      return ">" + formatAmountBN(maxCap, decimals);
    }
  } catch {
    return "-";
  }

  return formatAmountBN(amount, decimals, { displayDecimals });
}

/**
 * Format a number with comma separators and optional abbreviation.
 * @param number The number to format.
 * @param opts Options for formatting:
 *   - abbreviate: boolean (whether to abbreviate, e.g., 1.5K, 3.2M)
 *   - decimals: number (number of decimal places, default 2 if abbreviated)
 */
export function formatNumber(
  number: number,
  opts: {
    abbreviate?: {
      apply?: boolean;
      prefix?: string;
    };
    decimals?: number;
  } = {},
): string {
  if (number === null || number === undefined || isNaN(number)) return "-";
  const { abbreviate = { apply: false, prefix: "" }, decimals = 2 } = opts;

  if (!abbreviate.apply) {
    return number.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    });
  }

  const abs = Math.abs(number);
  let abbr = "";
  let value = number;

  if (abs >= 1_000_000_000) {
    value = number / 1_000_000_000;
    abbr = "B";
  } else if (abs >= 1_000_000) {
    value = number / 1_000_000;
    abbr = "M";
  } else if (abs >= 1_000) {
    value = number / 1_000;
    abbr = "K";
  }

  if (abbr) {
    // Always show at least one decimal if abbreviated, up to specified decimals
    return (
      value
        .toLocaleString(undefined, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: value < 10 && decimals > 1 ? 1 : 0,
        })
        .replace(/\.0+$/, "") +
      (abbreviate.prefix ?? "") +
      abbr
    );
  } else {
    return number.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    });
  }
}
