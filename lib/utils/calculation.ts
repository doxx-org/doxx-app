import { LiquidityMath, SqrtPriceMath } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { normalizeBN } from "./number";

/**
 * Calculate token amounts from liquidity and tick range
 * Based on Uniswap V3 / Raydium CLMM math
 */
export function getTokenAmountsFromLiquidity(
  liquidity: BN,
  tickLower: number,
  tickUpper: number,
  currentSqrtPriceX64: BN,
  decimals0: number,
  decimals1: number,
): { amount0: number; amount1: number } {
  // Convert ticks to sqrt prices
  const sqrtPriceX64Lower = SqrtPriceMath.getSqrtPriceX64FromTick(tickLower);
  const sqrtPriceX64Upper = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper);

  const amounts = LiquidityMath.getAmountsFromLiquidity(
    currentSqrtPriceX64, // Current pool price
    sqrtPriceX64Lower, // Position lower bound
    sqrtPriceX64Upper, // Position upper bound
    liquidity, // Position liquidity
    true,
  );

  return {
    amount0: Number(normalizeBN(amounts.amountA, decimals0)),
    amount1: Number(normalizeBN(amounts.amountB, decimals1)),
  };
}

/**
 * Convert tick to sqrt price (Q64.64 format)
 */
// function tickToSqrtPriceX64(tick: number): bigint {
//   const Q64 = BigInt(2) ** BigInt(64);

//   // Calculate 1.0001^tick
//   const price = Math.pow(1.0001, tick);
//   const sqrtPrice = Math.sqrt(price);

//   // Convert to Q64.64 fixed point
//   return BigInt(Math.floor(sqrtPrice * Number(Q64)));
// }

/**
 * Calculate amount0 from liquidity
 */
// function getAmount0FromLiquidity(
//   sqrtPriceA: BN,
//   sqrtPriceB: BN,
//   liquidity: BN,
// ): BN {
//   if (sqrtPriceA > sqrtPriceB) {
//     [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
//   }

//   const Q64 = new BN(2).pow(new BN(64));

//   const numerator = liquidity.mul(Q64).mul(sqrtPriceB.sub(sqrtPriceA));
//   const denominator = sqrtPriceB.mul(sqrtPriceA);

//   return numerator.div(denominator);
// }

/**
 * Calculate amount1 from liquidity
 */
// function getAmount1FromLiquidity(
//   sqrtPriceA: BN,
//   sqrtPriceB: BN,
//   liquidity: BN,
// ): BN {
//   if (sqrtPriceA > sqrtPriceB) {
//     [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
//   }

//   const Q64 = new BN(2).pow(new BN(64));

//   return liquidity.mul(sqrtPriceB.sub(sqrtPriceA)).div(Q64);
// }

const TWO_POW_128 = 1n << 128n;

/**
 * Convert bigint to BN helper
 */
export function bnToBigint(bn: BN): bigint {
  return BigInt(bn.toString());
}

/**
 * Convert sqrtPriceX64 to priceX128
 * sqrtPriceX64 is Q64.64, squaring gives Q128.128
 */
export function priceX128FromSqrtPriceX64(sqrtPriceX64: BN): bigint {
  const s = bnToBigint(sqrtPriceX64);
  return s * s; // numerator, denom=2^128
}

/**
 * Get token prices from CLMM pool
 *
 * @param sqrtPriceX64 - Pool's sqrt price in Q64.64 format
 * @param decimalsToken0 - Decimals for token0 (mintA)
 * @param decimalsToken1 - Decimals for token1 (mintB)
 * @returns Price in both directions with human-readable values
 */
export function calculateCLMMTokenPrices(params: {
  sqrtPriceX64: BN;
  decimalsToken0: number;
  decimalsToken1: number;
}): {
  priceToken1PerToken0: number; // How many token1 per 1 token0
  priceToken0PerToken1: number; // How many token0 per 1 token1
  raw: {
    priceX128: bigint;
    sqrtPriceX64: BN;
  };
} {
  const { sqrtPriceX64, decimalsToken0, decimalsToken1 } = params;

  // Calculate priceX128 using bigint for precision
  const priceX128 = priceX128FromSqrtPriceX64(sqrtPriceX64);

  // Convert to human-readable price
  // price_human = (priceX128 / 2^128) * 10^(dec0 - dec1)
  const decimalDiff = decimalsToken0 - decimalsToken1;
  const decimalScale = 10 ** decimalDiff;

  const priceToken1PerToken0 =
    (Number(priceX128) / Number(TWO_POW_128)) * decimalScale;

  const priceToken0PerToken1 =
    priceToken1PerToken0 <= 0 ? 0 : 1 / priceToken1PerToken0;

  return {
    priceToken1PerToken0,
    priceToken0PerToken1,
    raw: {
      priceX128,
      sqrtPriceX64,
    },
  };
}
