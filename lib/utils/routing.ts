// routing.ts
import { BN } from "@coral-xyz/anchor";
import { getAccount } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { BPS, MAX_UINT128, ONE_E9, ZERO } from "@/lib/constants";
import {
  AmmConfig,
  PoolState,
  PoolStateWithConfig,
} from "@/lib/hooks/chain/types";
import { parseAmountBN } from "@/lib/utils";
import { IUseBestRouteResponse } from "../hooks/chain/useBestRoute";
import { RoutingError } from "./errors/routing-error";

const ONE_M = new BN(1_000_000); // ppm

interface IGetBestQuoteParams {
  connection: Connection;
  pools: PoolStateWithConfig[];
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
  minMaxAmount: BN;
  priceImpact: BN;
}

type GetBestQuotePool = Pick<IUseBestRouteResponse, "pool">;

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
const inIs0 = (pool: PoolState, inMint: PublicKey) => {
  if (inMint.equals(pool.token0Mint)) return true;
  if (inMint.equals(pool.token1Mint)) return false;
  throw new Error("inMint not in pool");
};

const creatorFeeApplies = (pool: PoolState, inMint: PublicKey) => {
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
  pool: PoolState,
  ammConfig: AmmConfig,
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
  pool: PoolState,
  ammConfig: AmmConfig,
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
  pool: PoolState,
  ammConfig: AmmConfig,
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

    // apply slippage on output (decrease minOut)
    const minAmountOut = newAmountOut.muln(BPS - slippageBps).divn(BPS);

    // if new amount out is 0, skip
    if (minAmountOut.lte(ZERO)) {
      continue;
    }

    // if new amount out is greater than previous best amount out, update best
    if (
      !best ||
      newAmountOut.lt(best.swapState.token1Amount) ||
      minAmountOut.gt(best.swapState.minAmountOut)
    ) {
      const amountOutPerOneTokenIn = newAmountOut
        .mul(ONE_E9)
        .div(amountInTokenDecimals);
      // TODO: handle this
      const priceImpact = newAmountOut
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
        priceImpact,
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
    const amountOutTokenDecimals = parseAmountBN(
      amountOut,
      poolState.mint1Decimals,
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
      const amountOutPerOneTokenIn = maxAmountIn
        .mul(ONE_E9)
        .div(amountOutTokenDecimals);
      // TODO: handle this
      const priceImpact = newAmountIn
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
        priceImpact,
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
