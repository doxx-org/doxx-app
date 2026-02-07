import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/constants";
import { simplifyRoutingErrorMsg } from "@/lib/utils/errors/routing-error";
import {
  SwapState,
  getBestQuoteClmmSingleHopExactIn,
  getBestQuoteClmmSingleHopExactOut,
  getBestQuoteSingleHopExactIn,
  getBestQuoteSingleHopExactOut,
} from "../../utils/routing";
import { CLMMPoolStateWithConfig, CPMMPoolStateWithConfig } from "./types";
import { useMemo } from "react";
import { PoolType } from "@/components/earn/v2/types";

export type IUseBestRouteResponse = {
  poolType: PoolType;
  pool: CPMMPoolStateWithConfig | CLMMPoolStateWithConfig;
  swapState: SwapState;
};

export type IUseBestRouteParams = {
  connection: Connection;
  clmmProgramId?: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  baseInput: string;
  cpmmPools?: CPMMPoolStateWithConfig[] | undefined;
  clmmPools?: CLMMPoolStateWithConfig[] | undefined;
  isBaseExactIn: boolean;
  slippageBps?: number; // e.g. 50 = 0.5%
};

export function useBestRoute({
  connection,
  clmmProgramId,
  inputMint,
  outputMint,
  baseInput,
  cpmmPools,
  clmmPools,
  isBaseExactIn,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}: IUseBestRouteParams): UseQueryResult<IUseBestRouteResponse | null> {
  const isEnabled = useMemo(() => {
    return (
      !!baseInput &&
      baseInput !== "0" &&
      ((cpmmPools && cpmmPools.length > 0) || (clmmPools && clmmPools.length > 0)) &&
      inputMint.toString() !== "" &&
      outputMint.toString() !== ""
    );
  }, [baseInput, cpmmPools, clmmPools, inputMint, outputMint]);


  return useQuery({
    queryKey: [
      "best-route",
      inputMint.toString(),
      outputMint.toString(),
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
          inputMint.toString() === "" ||
          outputMint.toString() === ""
        )
          return null;

        // Calculate based on base input or base output
        if (isBaseExactIn) {
          const [cpmmQuote, clmmQuote] = await Promise.all([
            (async () => {
              if (!cpmmPools || cpmmPools.length === 0) return undefined;
              try {
                return await getBestQuoteSingleHopExactIn({
                  connection,
                  pools: cpmmPools,
                  inputMint,
                  outputMint,
                  amountIn: baseInput,
                  slippageBps,
                });
              } catch {
                return undefined;
              }
            })(),
            (async () => {
              if (!clmmPools || clmmPools.length === 0) return undefined;
              if (!clmmProgramId) return undefined;
              return await getBestQuoteClmmSingleHopExactIn({
                connection,
                clmmProgramId,
                pools: clmmPools,
                inputMint,
                outputMint,
                amountIn: baseInput,
                slippageBps,
              });
            })(),
          ]);

          const best =
            cpmmQuote && clmmQuote
              ? cpmmQuote.swapState.minAmountOut.gte(clmmQuote.swapState.minAmountOut)
                ? { poolType: PoolType.CPMM, pool: cpmmQuote.pool, swap: cpmmQuote.swapState }
                : { poolType: PoolType.CLMM, pool: clmmQuote.pool, swap: clmmQuote.swapState }
              : cpmmQuote
                ? { poolType: PoolType.CPMM, pool: cpmmQuote.pool, swap: cpmmQuote.swapState }
                : clmmQuote
                  ? { poolType: PoolType.CLMM, pool: clmmQuote.pool, swap: clmmQuote.swapState }
                  : undefined;

          if (!best) return null;

          const { minAmountOut, ...swapBase } = best.swap;
          return {
            poolType: best.poolType,
            pool: best.pool,
            swapState: {
              ...swapBase,
              isBaseExactIn: true,
              minMaxAmount: minAmountOut,
            },
          };
        }

        const [cpmmQuote, clmmQuote] = await Promise.all([
          (async () => {
            if (!cpmmPools || cpmmPools.length === 0) return undefined;
            try {
              return await getBestQuoteSingleHopExactOut({
                connection,
                pools: cpmmPools,
                inputMint,
                outputMint,
                amountOut: baseInput,
                slippageBps,
              });
            } catch {
              return undefined;
            }
          })(),
          (async () => {
            if (!clmmPools || clmmPools.length === 0) return undefined;
            if (!clmmProgramId) return undefined;
            return await getBestQuoteClmmSingleHopExactOut({
              connection,
              clmmProgramId,
              pools: clmmPools,
              inputMint,
              outputMint,
              amountOut: baseInput,
              slippageBps,
            });
          })(),
        ]);

        const best =
          cpmmQuote && clmmQuote
            ? cpmmQuote.swapState.maxAmountIn.lte(clmmQuote.swapState.maxAmountIn)
              ? { poolType: PoolType.CPMM, pool: cpmmQuote.pool, swap: cpmmQuote.swapState }
              : { poolType: PoolType.CLMM, pool: clmmQuote.pool, swap: clmmQuote.swapState }
            : cpmmQuote
              ? { poolType: PoolType.CPMM, pool: cpmmQuote.pool, swap: cpmmQuote.swapState }
              : clmmQuote
                ? { poolType: PoolType.CLMM, pool: clmmQuote.pool, swap: clmmQuote.swapState }
                : undefined;

        if (!best) return null;

        const { maxAmountIn, ...swapBase } = best.swap;
        return {
          poolType: best.poolType,
          pool: best.pool,
          swapState: {
            ...swapBase,
            isBaseExactIn: false,
            minMaxAmount: maxAmountIn,
          },
        };
      } catch (error) {
        console.log("🚀 ~ error:", error)
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
