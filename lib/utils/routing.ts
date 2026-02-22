// routing.ts
import { BN } from "@coral-xyz/anchor";
import { getAccount } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { BPS, MAX_UINT128, ONE_E9, ZERO } from "@/lib/constants";
import {
  CLMMPoolStateWithConfig,
  CPMMAmmConfig,
  CPMMPoolState,
  CPMMPoolStateWithConfig,
} from "@/lib/hooks/chain/types";
import { parseAmountBN } from "@/lib/utils";
import { RoutingError } from "./errors/routing-error";

const ONE_M = new BN(1_000_000); // ppm
const TWO_POW_128 = new BN(1).ushln(128);

interface IGetBestQuoteParams {
  connection: Connection;
  pools: CPMMPoolStateWithConfig[];
  inputMint: PublicKey;
  outputMint: PublicKey;
  slippageBps: number; // e.g. 50 = 0.5%; Max = 10_000 = 100%
}

export interface SwapState {
  token0: PublicKey;
  token1: PublicKey;
  token0Amount: BN;
  token1Amount: BN;
  token0Decimals: number;
  token1Decimals: number;
  isBaseExactIn: boolean;
  amountOutPerOneTokenIn: BN;
  amountInPerOneTokenOut: BN;
  minMaxAmount: BN;
  priceImpact: string;
}

type GetBestQuotePool = {
  pool: CPMMPoolStateWithConfig;
};

type GetBestQuoteSwapStateBase = Omit<
  SwapState,
  "isBaseExactIn" | "minMaxAmount"
>;

type GetBestQuoteExactInResult = GetBestQuotePool & {
  swapState: GetBestQuoteSwapStateBase & {
    minAmountOut: BN;
  };
};

type GetBestQuoteExactOutResult = GetBestQuotePool & {
  swapState: GetBestQuoteSwapStateBase & {
    maxAmountIn: BN;
  };
};

export type IGetBestQuoteResult = GetBestQuotePool & {
  swapState: GetBestQuoteSwapStateBase & { minMaxAmount: BN };
};

// ---------- fee helpers (ppm) ----------
const inIs0 = (pool: CPMMPoolState, inMint: PublicKey) => {
  if (inMint.equals(pool.token0Mint)) return true;
  if (inMint.equals(pool.token1Mint)) return false;
  throw new Error("inMint not in pool");
};

const creatorFeeApplies = (pool: CPMMPoolState, inMint: PublicKey) => {
  if (!pool.enableCreatorFee) return false;
  const is0 = inIs0(pool, inMint);
  // 0 bothToken, 1 onlyToken0, 2 onlyToken1
  return (
    pool.creatorFeeOn === 0 ||
    (pool.creatorFeeOn === 1 && is0) ||
    (pool.creatorFeeOn === 2 && !is0)
  );
};

const effFeePpm = (
  pool: CPMMPoolState,
  ammConfig: CPMMAmmConfig,
  inMint: PublicKey,
) => {
  let tradingFeeRate = ammConfig.tradeFeeRate; // u64 ppm in IDL
  if (creatorFeeApplies(pool, inMint)) {
    tradingFeeRate = tradingFeeRate.add(ammConfig.creatorFeeRate);
  }
  return tradingFeeRate.gt(ONE_M) ? ONE_M : tradingFeeRate;
};

// ---------- reserves (vault minus accrued fees) ----------
const reserves = (
  vault: BN,
  protocolFees: BN,
  fundFees: BN,
  creatorFees: BN,
  enableCreatorFees: boolean,
) => {
  return vault
    .sub(protocolFees)
    .sub(fundFees)
    .sub(enableCreatorFees ? creatorFees : ZERO);
};

// ---------- single-hop quotes ----------
function quoteOutSingle(
  pool: CPMMPoolState,
  ammConfig: CPMMAmmConfig,
  inMint: PublicKey,
  amountIn: BN,
  reserveToken0: BN,
  reserveToken1: BN,
): BN {
  if (amountIn.isZero()) return ZERO;
  const is0 = inIs0(pool, inMint);
  const x = is0 ? reserveToken0 : reserveToken1;
  const y = is0 ? reserveToken1 : reserveToken0;

  // no reserves, return 0
  if (x.isZero() || y.isZero()) {
    return ZERO;
  }

  const ppm = effFeePpm(pool, ammConfig, inMint);
  const inputWithFee = amountIn.mul(ONE_M.sub(ppm)).div(ONE_M);
  return inputWithFee.mul(y).div(x.add(inputWithFee));
}

function quoteInSingle(
  pool: CPMMPoolState,
  ammConfig: CPMMAmmConfig,
  outMint: PublicKey,
  amountOut: BN,
  reserveToken0: BN,
  reserveToken1: BN,
): BN {
  if (amountOut.isZero()) return ZERO;
  const outIs1 = outMint.equals(pool.token1Mint);
  const x = outIs1 ? reserveToken0 : reserveToken1; // input reserve
  const y = outIs1 ? reserveToken1 : reserveToken0; // output reserve

  // check if the amount out is greater than the reserve
  if (x.isZero() || y.isZero() || amountOut.gte(y)) {
    return MAX_UINT128;
  }

  // TODO: handle this
  const afterFee = amountOut.mul(x).div(y.sub(amountOut)); // amountIn*(1-fee)
  const inMint = outIs1 ? pool.token0Mint : pool.token1Mint;
  const denom = ONE_M.sub(effFeePpm(pool, ammConfig, inMint));

  return denom.isZero() ? MAX_UINT128 : afterFee.mul(ONE_M).div(denom);
}

// ---------- public: pick best pool (single hop) ----------
export async function getBestQuoteSingleHopExactIn(
  opts: IGetBestQuoteParams & {
    amountIn: string; // human readable format
  },
): Promise<GetBestQuoteExactInResult | undefined> {
  const { connection, pools, inputMint, outputMint, amountIn, slippageBps } =
    opts;
  let best: GetBestQuoteExactInResult | undefined = undefined;

  for (const pool of pools) {
    const poolState = pool.poolState;

    // skip if swap disabled: status bit2 (value 4)
    if ((poolState.status & 0b100) !== 0) {
      continue;
    }

    // get token mint from pool
    const token0Mint = poolState.token0Mint;
    const token1Mint = poolState.token1Mint;

    // check if the pool matches the input and output mints
    const matchesPair =
      (token0Mint.equals(inputMint) && token1Mint.equals(outputMint)) ||
      (token1Mint.equals(inputMint) && token0Mint.equals(outputMint));
    if (!matchesPair) {
      continue;
    }

    // get vaults from pool
    const [vault0Account, vault1Account] = await Promise.all([
      getAccount(connection, poolState.token0Vault),
      getAccount(connection, poolState.token1Vault),
    ]);

    // calculate reserve of token 0
    const reserveToken0 = reserves(
      new BN(vault0Account.amount.toString()),
      poolState.protocolFeesToken0,
      poolState.fundFeesToken0,
      poolState.creatorFeesToken0,
      poolState.enableCreatorFee,
    );

    // calculate reserve of token 1
    const reserveToken1 = reserves(
      new BN(vault1Account.amount.toString()),
      poolState.protocolFeesToken1,
      poolState.fundFeesToken1,
      poolState.creatorFeesToken1,
      poolState.enableCreatorFee,
    );

    // quick guard
    // if some reserve is 0, skip
    if (reserveToken0.lte(ZERO) || reserveToken1.lte(ZERO)) {
      continue;
    }

    // format amount into token decimals
    const amountInTokenDecimals = parseAmountBN(
      amountIn,
      poolState.mint0Decimals,
    );
    if (amountInTokenDecimals.lte(ZERO)) {
      continue;
    }

    // quote new amount out
    const newAmountOut = quoteOutSingle(
      poolState,
      pool.ammConfig,
      inputMint,
      amountInTokenDecimals,
      reserveToken0,
      reserveToken1,
    );

    if (newAmountOut.lte(ZERO)) {
      continue;
    }

    // apply slippage on output (decrease minOut)
    const minAmountOut = newAmountOut.muln(BPS - slippageBps).divn(BPS);

    // if new amount out is 0, skip
    if (minAmountOut.lte(ZERO)) {
      continue;
    }

    // if new amount out is greater than previous best amount out, update best
    if (
      !best ||
      newAmountOut.gt(best.swapState.token1Amount) ||
      minAmountOut.gt(best.swapState.minAmountOut)
    ) {
      // amount out per one token in
      const amountOutPerOneTokenIn = newAmountOut
        .mul(ONE_E9)
        .div(amountInTokenDecimals);

      // amount in per one token out
      const amountInPerOneTokenOut = amountInTokenDecimals
        .mul(ONE_E9)
        .div(newAmountOut);

      // TODO: handle this
      const _priceImpact = newAmountOut
        .sub(minAmountOut)
        .mul(ONE_E9)
        .div(newAmountOut);

      const swapState: GetBestQuoteSwapStateBase = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: amountInTokenDecimals,
        token1Amount: newAmountOut,
        token0Decimals: poolState.mint0Decimals,
        token1Decimals: poolState.mint1Decimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: "N/A",
      };

      best = {
        swapState: { ...swapState, minAmountOut },
        pool: pool,
      };
    }
  }

  if (
    !best ||
    best.swapState.minAmountOut.lte(ZERO) ||
    best.swapState.minAmountOut.gte(MAX_UINT128)
  ) {
    throw new Error(RoutingError.NO_BEST_QUOTE_FOUND);
  }

  return best;
}

export async function getBestQuoteSingleHopExactOut(
  opts: IGetBestQuoteParams & {
    amountOut: string; // human readable format
  },
): Promise<GetBestQuoteExactOutResult | undefined> {
  const { connection, pools, inputMint, outputMint, amountOut, slippageBps } =
    opts;
  let best: GetBestQuoteExactOutResult | undefined = undefined;

  for (const pool of pools) {
    const poolState = pool.poolState;

    if ((poolState.status & 0b100) !== 0) {
      continue;
    }

    // get token mint from pool
    const token0Mint = poolState.token0Mint;
    const token1Mint = poolState.token1Mint;

    // check if the pool matches the input and output mints
    const matchesPair =
      (token0Mint.equals(inputMint) && token1Mint.equals(outputMint)) ||
      (token1Mint.equals(inputMint) && token0Mint.equals(outputMint));
    if (!matchesPair) {
      continue;
    }

    // get vaults from pool
    const [vault0Account, vault1Account] = await Promise.all([
      getAccount(connection, poolState.token0Vault),
      getAccount(connection, poolState.token1Vault),
    ]);

    // calculate reserve of token 0
    const reserveToken0 = reserves(
      new BN(vault0Account.amount.toString()),
      poolState.protocolFeesToken0,
      poolState.fundFeesToken0,
      poolState.creatorFeesToken0,
      poolState.enableCreatorFee,
    );

    // calculate reserve of token 1
    const reserveToken1 = reserves(
      new BN(vault1Account.amount.toString()),
      poolState.protocolFeesToken1,
      poolState.fundFeesToken1,
      poolState.creatorFeesToken1,
      poolState.enableCreatorFee,
    );

    // quick guard
    // if some reserve is 0, skip
    if (reserveToken0.lte(ZERO) || reserveToken1.lte(ZERO)) {
      continue;
    }

    // format amount into token decimals
    const outIsToken1 = outputMint.equals(poolState.token1Mint);
    const amountOutTokenDecimals = parseAmountBN(
      amountOut,
      outIsToken1 ? poolState.mint1Decimals : poolState.mint0Decimals,
    );
    if (amountOutTokenDecimals.lte(ZERO)) {
      continue;
    }

    // quote new amount in
    const newAmountIn = quoteInSingle(
      poolState,
      pool.ammConfig,
      outputMint,
      amountOutTokenDecimals,
      reserveToken0,
      reserveToken1,
    );

    if (newAmountIn.lte(ZERO)) {
      continue;
    }

    // apply slippage on input (increase maxIn)
    const maxAmountIn = newAmountIn.muln(BPS + slippageBps).divn(BPS);

    // if new amount in is 0, skip
    if (maxAmountIn.lte(ZERO) || maxAmountIn.lte(ZERO)) {
      continue;
    }

    // if new amount in is less than previous best amount in, update best
    if (
      !best ||
      newAmountIn.lt(best.swapState.token0Amount) ||
      maxAmountIn.lt(best.swapState.maxAmountIn)
    ) {
      // amount out per one token in
      const amountOutPerOneTokenIn = amountOutTokenDecimals
        .mul(ONE_E9)
        .div(newAmountIn);

      // amount in per one token out
      const amountInPerOneTokenOut = newAmountIn
        .mul(ONE_E9)
        .div(amountOutTokenDecimals);

      // TODO: handle this
      const _priceImpact = newAmountIn
        .sub(maxAmountIn)
        .mul(ONE_E9)
        .div(newAmountIn);

      const swapState: GetBestQuoteSwapStateBase = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: newAmountIn,
        token1Amount: amountOutTokenDecimals,
        token0Decimals: poolState.mint0Decimals,
        token1Decimals: poolState.mint1Decimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: "N/A",
      };

      best = {
        swapState: { ...swapState, maxAmountIn },
        pool: pool,
      };
    }
  }

  if (
    !best ||
    best.swapState.maxAmountIn.lte(ZERO) ||
    best.swapState.maxAmountIn.gte(MAX_UINT128)
  ) {
    throw new Error(RoutingError.NO_BEST_QUOTE_FOUND);
  }

  return best;
}

// ==============================================
// CLMM (spot) quotes (single hop)
// NOTE: This is a lightweight approximation using current sqrtPriceX64.
// It does NOT walk ticks, so large trades may deviate.
// ==============================================

interface IGetBestQuoteClmmParams {
  connection: Connection;
  clmmProgramId: PublicKey;
  pools: CLMMPoolStateWithConfig[];
  inputMint: PublicKey;
  outputMint: PublicKey;
  slippageBps: number;
}

type GetBestQuoteClmmPool = {
  pool: CLMMPoolStateWithConfig;
};

export type GetBestQuoteClmmExactInResult = GetBestQuoteClmmPool & {
  swapState: GetBestQuoteSwapStateBase & { minAmountOut: BN };
};

export type GetBestQuoteClmmExactOutResult = GetBestQuoteClmmPool & {
  swapState: GetBestQuoteSwapStateBase & { maxAmountIn: BN };
};

// CLMM tick array PDA uses big-endian i32 seed.
function i32ToBeBytes(num: number): Buffer {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return Buffer.from(arr);
}

const CLMM_TICK_ARRAY_SIZE = 60;
const CLMM_TICK_ARRAY_SEED = Buffer.from("tick_array", "utf8");

function getClmmTickArrayStartIndex(params: {
  tickCurrent: number;
  tickSpacing: number;
}) {
  const { tickCurrent, tickSpacing } = params;
  const arraySpacing = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  if (arraySpacing === 0) return 0;
  return Math.floor(tickCurrent / arraySpacing) * arraySpacing;
}

function getClmmTickArrayAddress(params: {
  poolId: PublicKey;
  startTickIndex: number;
  programId: PublicKey;
}): PublicKey {
  const { poolId, startTickIndex, programId } = params;
  return PublicKey.findProgramAddressSync(
    [CLMM_TICK_ARRAY_SEED, poolId.toBuffer(), i32ToBeBytes(startTickIndex)],
    programId,
  )[0];
}

function clmmInputWithFee(amountIn: BN, tradeFeeRate: BN) {
  // tradeFeeRate is in ppm (1e-6) per Raydium-style docs
  const fee = tradeFeeRate.gt(ONE_M) ? ONE_M : tradeFeeRate;
  return amountIn.mul(ONE_M.sub(fee)).div(ONE_M);
}

function clmmAmountOutFromSqrtPriceX64(params: {
  amountIn: BN;
  sqrtPriceX64: BN;
  zeroForOne: boolean;
}): BN {
  const { amountIn, sqrtPriceX64, zeroForOne } = params;
  if (amountIn.isZero()) return ZERO;
  const priceX128 = sqrtPriceX64.mul(sqrtPriceX64); // Q128.128
  if (priceX128.isZero()) return ZERO;

  // token0 -> token1 (zeroForOne): out = in * price
  if (zeroForOne) {
    return amountIn.mul(priceX128).div(TWO_POW_128);
  }

  // token1 -> token0 (oneForZero): out = in / price
  return amountIn.mul(TWO_POW_128).div(priceX128);
}

function clmmAmountInFromSqrtPriceX64(params: {
  amountOut: BN;
  sqrtPriceX64: BN;
  zeroForOne: boolean;
}): BN {
  const { amountOut, sqrtPriceX64, zeroForOne } = params;
  if (amountOut.isZero()) return ZERO;
  const priceX128 = sqrtPriceX64.mul(sqrtPriceX64); // Q128.128
  if (priceX128.isZero()) return MAX_UINT128;

  // want token1 out, paying token0 in (zeroForOne): out = in * price => in = out / price
  if (zeroForOne) {
    return amountOut.mul(TWO_POW_128).div(priceX128);
  }

  // want token0 out, paying token1 in (oneForZero): out = in / price => in = out * price
  return amountOut.mul(priceX128).div(TWO_POW_128);
}

export async function getBestQuoteClmmSingleHopExactIn(
  opts: IGetBestQuoteClmmParams & { amountIn: string },
): Promise<GetBestQuoteClmmExactInResult | undefined> {
  const {
    connection,
    clmmProgramId,
    pools,
    inputMint,
    outputMint,
    amountIn,
    slippageBps,
  } = opts;
  let best: GetBestQuoteClmmExactInResult | undefined;

  // Pre-filter candidates and batch-check existence of current tick array PDA.
  const candidates: CLMMPoolStateWithConfig[] = [];
  const tickArrayPdas: PublicKey[] = [];
  for (const pool of pools) {
    const ps = pool.poolState;
    if ((ps.status & 0b1_0000) !== 0) continue;
    if (ps.liquidity.eq(ZERO)) continue;

    const matchesPair =
      (ps.tokenMint0.equals(inputMint) && ps.tokenMint1.equals(outputMint)) ||
      (ps.tokenMint1.equals(inputMint) && ps.tokenMint0.equals(outputMint));
    if (!matchesPair) continue;

    const start = getClmmTickArrayStartIndex({
      tickCurrent: ps.tickCurrent,
      tickSpacing: ps.tickSpacing,
    });
    candidates.push(pool);
    tickArrayPdas.push(
      getClmmTickArrayAddress({
        poolId: pool.poolId,
        startTickIndex: start,
        programId: clmmProgramId,
      }),
    );
  }

  const tickArrayInfos =
    tickArrayPdas.length > 0
      ? await connection.getMultipleAccountsInfo(tickArrayPdas)
      : [];

  for (let i = 0; i < candidates.length; i++) {
    // Skip pools where the *current* tick array account doesn't exist.
    // These pools will fail swapping with "Missing current tick array account".
    if (!tickArrayInfos[i]) continue;

    const pool = candidates[i];
    const poolState = pool.poolState;

    // skip if swap disabled: status bit4 (value 16)
    if ((poolState.status & 0b1_0000) !== 0) continue;

    const inputDecimals = poolState.tokenMint0.equals(inputMint)
      ? poolState.mintDecimals0
      : poolState.mintDecimals1;
    const outputDecimals = poolState.tokenMint0.equals(inputMint)
      ? poolState.mintDecimals1
      : poolState.mintDecimals0;

    const amountInTokenDecimals = parseAmountBN(amountIn, inputDecimals);
    if (amountInTokenDecimals.lte(ZERO)) continue;

    const amountInAfterFee = clmmInputWithFee(
      amountInTokenDecimals,
      new BN(pool.ammConfig.tradeFeeRate.toString()),
    );
    const zeroForOne = inputMint.equals(poolState.tokenMint0);
    const amountOut = clmmAmountOutFromSqrtPriceX64({
      amountIn: amountInAfterFee,
      sqrtPriceX64: new BN(poolState.sqrtPriceX64.toString()),
      zeroForOne,
    });
    if (amountOut.lte(ZERO)) continue;

    const minAmountOut = amountOut.muln(BPS - slippageBps).divn(BPS);
    if (minAmountOut.lte(ZERO)) continue;

    if (!best || minAmountOut.gt(best.swapState.minAmountOut)) {
      const amountOutPerOneTokenIn = amountOut
        .mul(ONE_E9)
        .div(amountInTokenDecimals);
      const amountInPerOneTokenOut = amountInTokenDecimals
        .mul(ONE_E9)
        .div(amountOut);
      const swapState: GetBestQuoteSwapStateBase = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: amountInTokenDecimals,
        token1Amount: amountOut,
        token0Decimals: inputDecimals,
        token1Decimals: outputDecimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: "N/A",
      };
      best = { pool, swapState: { ...swapState, minAmountOut } };
    }
  }

  return best;
}

export async function getBestQuoteClmmSingleHopExactOut(
  opts: IGetBestQuoteClmmParams & { amountOut: string },
): Promise<GetBestQuoteClmmExactOutResult | undefined> {
  const {
    connection,
    clmmProgramId,
    pools,
    inputMint,
    outputMint,
    amountOut,
    slippageBps,
  } = opts;
  let best: GetBestQuoteClmmExactOutResult | undefined;

  const candidates: CLMMPoolStateWithConfig[] = [];
  const tickArrayPdas: PublicKey[] = [];
  for (const pool of pools) {
    const ps = pool.poolState;
    if ((ps.status & 0b1_0000) !== 0) continue;
    if (ps.liquidity.eq(ZERO)) continue;

    const matchesPair =
      (ps.tokenMint0.equals(inputMint) && ps.tokenMint1.equals(outputMint)) ||
      (ps.tokenMint1.equals(inputMint) && ps.tokenMint0.equals(outputMint));
    if (!matchesPair) continue;

    const start = getClmmTickArrayStartIndex({
      tickCurrent: ps.tickCurrent,
      tickSpacing: ps.tickSpacing,
    });
    candidates.push(pool);
    tickArrayPdas.push(
      getClmmTickArrayAddress({
        poolId: pool.poolId,
        startTickIndex: start,
        programId: clmmProgramId,
      }),
    );
  }

  const tickArrayInfos =
    tickArrayPdas.length > 0
      ? await connection.getMultipleAccountsInfo(tickArrayPdas)
      : [];

  for (let i = 0; i < candidates.length; i++) {
    if (!tickArrayInfos[i]) continue;

    const pool = candidates[i];
    const poolState = pool.poolState;

    if ((poolState.status & 0b1_0000) !== 0) continue;

    const inputDecimals = poolState.tokenMint0.equals(inputMint)
      ? poolState.mintDecimals0
      : poolState.mintDecimals1;
    const outputDecimals = poolState.tokenMint0.equals(inputMint)
      ? poolState.mintDecimals1
      : poolState.mintDecimals0;

    const amountOutTokenDecimals = parseAmountBN(amountOut, outputDecimals);
    if (amountOutTokenDecimals.lte(ZERO)) continue;

    const zeroForOne = inputMint.equals(poolState.tokenMint0);
    const amountInNoFee = clmmAmountInFromSqrtPriceX64({
      amountOut: amountOutTokenDecimals,
      sqrtPriceX64: new BN(poolState.sqrtPriceX64.toString()),
      zeroForOne,
    });
    if (amountInNoFee.lte(ZERO) || amountInNoFee.gte(MAX_UINT128)) continue;

    const fee = new BN(pool.ammConfig.tradeFeeRate.toString());
    const denom = ONE_M.sub(fee.gt(ONE_M) ? ONE_M : fee);
    const amountIn = denom.isZero()
      ? MAX_UINT128
      : amountInNoFee.mul(ONE_M).div(denom);

    const maxAmountIn = amountIn.muln(BPS + slippageBps).divn(BPS);
    if (maxAmountIn.lte(ZERO) || maxAmountIn.gte(MAX_UINT128)) continue;

    if (!best || maxAmountIn.lt(best.swapState.maxAmountIn)) {
      const amountOutPerOneTokenIn = amountOutTokenDecimals
        .mul(ONE_E9)
        .div(amountIn);
      const amountInPerOneTokenOut = amountIn
        .mul(ONE_E9)
        .div(amountOutTokenDecimals);
      const swapState: GetBestQuoteSwapStateBase = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: amountIn,
        token1Amount: amountOutTokenDecimals,
        token0Decimals: inputDecimals,
        token1Decimals: outputDecimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: "N/A",
      };
      best = { pool, swapState: { ...swapState, maxAmountIn } };
    }
  }

  return best;
}
