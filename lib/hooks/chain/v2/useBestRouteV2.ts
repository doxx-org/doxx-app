import { useMemo } from "react";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  Raydium as CpmmRaydium,
} from "@doxxorg/cpmm-sdk";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { PoolType } from "@/components/earn/v2/types";
import { TokenProfile } from "@/lib/config/tokens";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/constants";
import { simplifyRoutingErrorMsg } from "@/lib/utils/errors/routing-error";
import { parseAmountBN } from "@/lib/utils/number";
import {
  IBestRouteV2BaseIn,
  IBestRouteV2BaseOut,
  ISwapStateV2,
  findBestClmmSwapBaseIn,
  findBestClmmSwapBaseOut,
  findBestCpmmSwapBaseIn,
  findBestCpmmSwapBaseOut,
} from "@/lib/utils/routingV2";
import { CLMMPoolStateWithConfig, CPMMPoolStateWithConfig } from "../types";

export type IUseBestRouteV2Response = {
  poolType: PoolType;
  pool: CPMMPoolStateWithConfig | CLMMPoolStateWithConfig;
  swapState: ISwapStateV2;
  remainingAccounts: PublicKey[];
  poolInfo: ApiV3PoolInfoConcentratedItem | ApiV3PoolInfoStandardItemCpmm;
  poolKeys: ClmmKeys | CpmmKeys;
};

export type IUseBestRouteV2Params = {
  raydium: Raydium | undefined;
  cpmmRaydium: CpmmRaydium | undefined;
  inputToken: TokenProfile;
  outputToken: TokenProfile;
  baseInput: string;
  cpmmPools: CPMMPoolStateWithConfig[] | undefined;
  clmmPools: CLMMPoolStateWithConfig[] | undefined;
  isBaseExactIn: boolean;
  slippageBps?: number; // e.g. 50 = 0.5%
};

export function useBestRouteV2({
  raydium,
  cpmmRaydium,
  inputToken,
  outputToken,
  baseInput,
  cpmmPools,
  clmmPools,
  isBaseExactIn,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}: IUseBestRouteV2Params): UseQueryResult<IUseBestRouteV2Response | null> {
  const isEnabled = useMemo(() => {
    return (
      !!baseInput &&
      baseInput !== "0" &&
      ((cpmmPools !== undefined && cpmmPools.length > 0) ||
        (clmmPools !== undefined && clmmPools.length > 0)) &&
      inputToken.address !== "" &&
      outputToken.address !== "" &&
      (!!raydium || !!cpmmRaydium)
    );
  }, [
    baseInput,
    cpmmPools,
    clmmPools,
    inputToken.address,
    outputToken.address,
    raydium,
    cpmmRaydium,
  ]);

  return useQuery({
    queryKey: [
      "best-route-v2",
      inputToken.address,
      outputToken.address,
      baseInput,
      slippageBps,
      isBaseExactIn,
    ],
    queryFn: async () => {
      try {
        if (
          !baseInput ||
          baseInput === "0" ||
          ((!cpmmPools || cpmmPools.length === 0) &&
            (!clmmPools || clmmPools.length === 0)) ||
          inputToken.address === "" ||
          outputToken.address === ""
        )
          return null;

        if (isBaseExactIn) {
          const amountIn = parseAmountBN(baseInput, inputToken.decimals);

          const [clmmResult, _cpmmResult] = await Promise.allSettled([
            raydium
              ? findBestClmmSwapBaseIn({
                  raydium,
                  clmmPools,
                  inputToken,
                  outputToken,
                  amountIn,
                  epochInfo: await raydium.fetchEpochInfo(),
                  slippageBps,
                })
              : Promise.reject(new Error("No CLMM raydium")),
            cpmmRaydium
              ? findBestCpmmSwapBaseIn({
                  cpmmRaydium,
                  cpmmPools,
                  inputToken,
                  outputToken,
                  amountIn,
                  epochInfo: {} as never,
                  slippageBps,
                })
              : Promise.reject(new Error("No CPMM raydium")),
          ]);

          const clmmQuote =
            clmmResult.status === "fulfilled" ? clmmResult.value : null;
          // const cpmmQuote =
          //   cpmmResult.status === "fulfilled" ? cpmmResult.value : null;
          const cpmmQuote = null;

          const best = pickBestBaseIn(clmmQuote, cpmmQuote);
          if (!best) throw new Error("No route found");
          return best;
        }

        // Base-exact-out: run CLMM and CPMM in parallel, return best
        const amountOut = parseAmountBN(baseInput, outputToken.decimals);

        const [clmmOutResult, _cpmmOutResult] = await Promise.allSettled([
          raydium
            ? findBestClmmSwapBaseOut({
                raydium,
                clmmPools,
                amountOut,
                inputToken,
                outputToken,
                epochInfo: await raydium.fetchEpochInfo(),
                slippageBps,
              })
            : Promise.reject(new Error("No CLMM raydium")),
          cpmmRaydium
            ? findBestCpmmSwapBaseOut({
                cpmmRaydium,
                cpmmPools,
                amountOut,
                inputToken,
                outputToken,
                epochInfo: {} as never,
                slippageBps,
              })
            : Promise.reject(new Error("No CPMM raydium")),
        ]);

        const clmmOutQuote =
          clmmOutResult.status === "fulfilled" ? clmmOutResult.value : null;
        const cpmmOutQuote = null;
        // const cpmmOutQuote =
        // cpmmOutResult.status === "fulfilled" ? cpmmOutResult.value : null;

        const best = pickBestBaseOut(clmmOutQuote, cpmmOutQuote);
        if (!best) throw new Error("No route found");
        return best;
      } catch (error) {
        console.log("🚀 ~ error:", error);
        throw new Error(simplifyRoutingErrorMsg(error));
      }
    },
    enabled: isEnabled,
    // UX stability: avoid flashing/loading state on each keystroke; keep last data while refetching
    // keepPreviousData: true,
    // Quotes are quickly stale but not instant; allow brief reuse to prevent thrash
    staleTime: 10_000,
    gcTime: 30_000,
    // Cancel in-flight quotes when params change
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/**
 * Pick the quote with the highest output amount (best deal for the user).
 * A null quote (failed/no matching pool) is always beaten by a valid one.
 */
function pickBestBaseIn(
  clmm: IBestRouteV2BaseIn | null,
  cpmm: IBestRouteV2BaseIn | null,
): IBestRouteV2BaseIn | null {
  if (!clmm && !cpmm) return null;
  if (!clmm) return cpmm;
  if (!cpmm) return clmm;

  // Higher minAmountOut = better route for the user
  return clmm.minAmountOut.amount.gte(cpmm.minAmountOut.amount) ? clmm : cpmm;
}

/**
 * Pick the quote with the lowest required input amount (best deal for the user).
 * A null quote is always beaten by a valid one.
 */
function pickBestBaseOut(
  clmm: IBestRouteV2BaseOut | null,
  cpmm: IBestRouteV2BaseOut | null,
): IBestRouteV2BaseOut | null {
  if (!clmm && !cpmm) return null;
  if (!clmm) return cpmm;
  if (!cpmm) return clmm;

  // Lower maxAmountIn = less you need to pay = better route
  return clmm.maxAmountIn.amount.lte(cpmm.maxAmountIn.amount) ? clmm : cpmm;
}
