import BN from "bn.js";

/**
 * Calculate token amounts from liquidity and tick range
 * Based on Uniswap V3 / Raydium CLMM math
 */
export function getTokenAmountsFromLiquidity(
  liquidity: BN,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  decimals0: number,
  decimals1: number,
): { amount0: number; amount1: number } {
  // Convert ticks to sqrt prices
  const sqrtPriceLower = new BN(tickToSqrtPriceX64(tickLower));
  const sqrtPriceUpper = new BN(tickToSqrtPriceX64(tickUpper));
  const sqrtPriceCurrent = new BN(tickToSqrtPriceX64(currentTick));

  let amount0 = new BN(0);
  let amount1 = new BN(0);

  // Position is entirely in token1
  if (currentTick < tickLower) {
    amount0 = getAmount0FromLiquidity(
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity
    );
  }
  // Position is entirely in token0
  else if (currentTick >= tickUpper) {
    amount1 = getAmount1FromLiquidity(
      sqrtPriceLower,
      sqrtPriceUpper,
      liquidity
    );
  }
  // Position is active (has both tokens)
  else {
    amount0 = getAmount0FromLiquidity(
      sqrtPriceCurrent,
      sqrtPriceUpper,
      liquidity
    );
    amount1 = getAmount1FromLiquidity(
      sqrtPriceLower,
      sqrtPriceCurrent,
      liquidity
    );
  }

  // Convert to human-readable amounts
  return {
    amount0: Number(amount0) / Math.pow(10, decimals0),
    amount1: Number(amount1) / Math.pow(10, decimals1),
  };
}

/**
 * Convert tick to sqrt price (Q64.64 format)
 */
function tickToSqrtPriceX64(tick: number): bigint {
  const Q64 = BigInt(2) ** BigInt(64);

  // Calculate 1.0001^tick
  const price = Math.pow(1.0001, tick);
  const sqrtPrice = Math.sqrt(price);

  // Convert to Q64.64 fixed point
  return BigInt(Math.floor(sqrtPrice * Number(Q64)));
}

/**
 * Calculate amount0 from liquidity
 */
function getAmount0FromLiquidity(
  sqrtPriceA: BN,
  sqrtPriceB: BN,
  liquidity: BN
): BN {
  if (sqrtPriceA > sqrtPriceB) {
    [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  }

  const Q64 = new BN(2).pow(new BN(64));

  const numerator = liquidity.mul(Q64).mul(sqrtPriceB.sub(sqrtPriceA));
  const denominator = sqrtPriceB.mul(sqrtPriceA);

  return numerator.div(denominator);
}

/**
 * Calculate amount1 from liquidity
 */
function getAmount1FromLiquidity(
  sqrtPriceA: BN,
  sqrtPriceB: BN,
  liquidity: BN
): BN {
  if (sqrtPriceA > sqrtPriceB) {
    [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  }

  const Q64 = new BN(2).pow(new BN(64));

  return liquidity.mul(sqrtPriceB.sub(sqrtPriceA)).div(Q64);
}