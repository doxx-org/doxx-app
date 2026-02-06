import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { CLMM_MAX_TICK, CLMM_MIN_TICK, CLMM_TICK_ARRAY_SIZE, LOG_1P0001 } from "../constants";

export function u16ToBytes(num: number): Uint8Array {
  const arr = new ArrayBuffer(2);
  const view = new DataView(arr);
  view.setUint16(0, num, false);
  return new Uint8Array(arr);
}

export function i32ToBeBytes(num: number): Buffer {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return Buffer.from(arr);
}

export function bnToBigint(bn: BN): bigint {
  return BigInt(bn.toString());
}

export function bigintToBn(x: bigint): BN {
  return new BN(x.toString());
}


export function mulByPpm(x: bigint, ppm: number): bigint {
  return (x * BigInt(ppm)) / 1_000_000n;
}

export function mulDiv(a: bigint, b: bigint, den: bigint): bigint {
  if (den === 0n) throw new Error("mulDiv division by zero");
  return (a * b) / den;
}

export function priceX128FromSqrtPriceX64(sqrtPriceX64: BN): bigint {
  const s = bnToBigint(sqrtPriceX64);
  return s * s; // numerator, denom=2^128
}

export function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return 10n ** BigInt(exp);
}

export function parseDecimalToFraction(value: string): { num: bigint; den: bigint } {
  const v = value.trim();
  if (!v) throw new Error("Price is required");
  if (v.startsWith("-")) throw new Error("Price must be positive");
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error("Invalid price format");

  const [intPart, fracPart = ""] = v.split(".");
  const digits = (intPart + fracPart).replace(/^0+(?=\d)/, "");
  const num = BigInt(digits || "0");
  const den = pow10(fracPart.length);
  return { num, den };
}

export function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + n / x1) >> 1n;
  }
  return x0;
}

/**
 * Convert UI price "tokenA per tokenB" into CLMM sqrtPriceX64 for ordered (tokenMint0, tokenMint1).
 * CLMM defines price as (amount_token_1 / amount_token_0) in base units.
 */
export function computeSqrtPriceX64(params: {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  priceAperB: string;
}): BN {
  const {
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
    priceAperB,
  } = params;

  const { num: pabNum, den: pabDen } = parseDecimalToFraction(priceAperB);
  if (pabNum === 0n) throw new Error("Price must be greater than 0");

  const aIs0 = tokenAMint.equals(tokenMint0);
  const aIs1 = tokenAMint.equals(tokenMint1);
  const bIs0 = tokenBMint.equals(tokenMint0);
  const bIs1 = tokenBMint.equals(tokenMint1);
  if ((!aIs0 && !aIs1) || (!bIs0 && !bIs1)) {
    throw new Error("Token mints do not match token0/token1 ordering");
  }

  // Pab = A/B (human). Need P10 = token1/token0 (human).
  let p10Num = pabNum;
  let p10Den = pabDen;
  const token0Decimals = aIs0 ? tokenADecimals : tokenBDecimals;
  const token1Decimals = aIs0 ? tokenBDecimals : tokenADecimals;
  if (aIs0) {
    p10Num = pabDen;
    p10Den = pabNum;
  }

  // Convert to base-unit ratio: price_base = price_human * 10^(dec1-dec0)
  const decDiff = token1Decimals - token0Decimals;
  if (decDiff >= 0) p10Num = p10Num * pow10(decDiff);
  else p10Den = p10Den * pow10(-decDiff);

  const scaled = (p10Num << 128n) / p10Den;
  const sqrt = bigintSqrt(scaled);
  const maxU128 = (1n << 128n) - 1n;
  if (sqrt < 0n || sqrt > maxU128) throw new Error("Price out of supported range");
  return new BN(sqrt.toString());
}

export function clampTick(t: number, spacing: number) {
  const minAllowed = Math.ceil(CLMM_MIN_TICK / spacing) * spacing;
  const maxAllowed = Math.floor(CLMM_MAX_TICK / spacing) * spacing;
  return Math.min(maxAllowed, Math.max(minAllowed, t));
}

/**
 * Convert UI price (A/B) into tick index for ordered (token0, token1).
 * Tick is based on base-unit price = token1/token0 * 10^(dec1-dec0).
 *
 * We compute in log space to avoid overflow.
 */
export function tickFromPriceAperB(params: {
  priceAperB: number;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
}): number {
  const {
    priceAperB,
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
  } = params;

  const aIs0 = tokenAMint.equals(tokenMint0);
  const aIs1 = tokenAMint.equals(tokenMint1);
  const bIs0 = tokenBMint.equals(tokenMint0);
  const bIs1 = tokenBMint.equals(tokenMint1);
  if ((!aIs0 && !aIs1) || (!bIs0 && !bIs1)) {
    throw new Error("Token mints do not match token0/token1 ordering");
  }

  const token0Decimals = aIs0 ? tokenADecimals : tokenBDecimals;
  const token1Decimals = aIs0 ? tokenBDecimals : tokenADecimals;

  // Pab = A/B (human). P10(human) = token1/token0 is either Pab (A=token1) or 1/Pab (A=token0).
  const safe = Math.max(priceAperB, 1e-18);
  const logP10Human = aIs0 ? -Math.log(safe) : Math.log(safe);
  const logDecScale = (token1Decimals - token0Decimals) * Math.log(10);
  const logPriceBase = logP10Human + logDecScale;

  return Math.floor(logPriceBase / LOG_1P0001);
}

export function tickArrayStartIndex(tickIndex: number, tickSpacing: number): number {
  const arraySpacing = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  if (arraySpacing === 0) return 0;
  return Math.floor(tickIndex / arraySpacing) * arraySpacing;
}

export function applyBuffer(amount: BN, bufferPct: number | undefined): BN {
  const pct = bufferPct ?? 0;
  if (!Number.isFinite(pct) || pct <= 0) return amount;
  // multiplier in ppm to avoid floats as much as possible: (1 + pct) * 1e6
  const mul = Math.floor((1 + pct) * 1_000_000);
  return amount.muln(mul).divn(1_000_000);
}

export function estimateLegacyTxSize(params: {
  feePayer: PublicKey;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
  signers?: Keypair[];
}) {
  const { feePayer, recentBlockhash, instructions, signers = [] } = params;
  try {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = feePayer;
    tx.recentBlockhash = recentBlockhash;
    if (signers.length > 0) tx.partialSign(...signers);
    // Signature bytes are a fixed-width part of the serialized tx; content doesn't change size.
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  } catch {
    // `Transaction.serialize` throws when the legacy tx is too large.
    // For sizing/planning purposes, treat this as "definitely too large".
    return Number.POSITIVE_INFINITY;
  }
}
