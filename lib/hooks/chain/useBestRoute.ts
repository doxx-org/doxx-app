import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/constants";
import {
  IGetBestQuoteResult,
  getBestQuoteSingleHopExactIn,
  getBestQuoteSingleHopExactOut,
} from "../../utils/routing";
import { AmmConfig, PoolState, PoolStateWithConfig } from "./types";

export type IUseBestRouteResponse = {
  pool: PoolState;
  token0: PublicKey;
  token1: PublicKey;
  token0Amount: BN;
  token1Amount: BN;
  token0Decimals: number;
  token1Decimals: number;
  isBaseExactIn: boolean;
  amountOutPerOneTokenIn: BN;
};

export type IUseBestRouteParams = {
  connection: Connection;
  inputMint: PublicKey;
  outputMint: PublicKey;
  baseInput: string;
  pools: PoolStateWithConfig[] | undefined;
  isBaseExactIn: boolean;
  slippageBps?: number; // e.g. 50 = 0.5%
};

export function useBestRoute({
  connection,
  inputMint,
  outputMint,
  baseInput,
  pools,
  isBaseExactIn,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}: IUseBestRouteParams): UseQueryResult<IUseBestRouteResponse | null> {
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
      if (
        !baseInput ||
        baseInput === "0" ||
        !pools ||
        pools.length === 0 ||
        inputMint.toString() === "" ||
        outputMint.toString() === ""
      )
        return null;

      const poolStates = pools.map((pool) => pool.poolState);
      const ammByPk = new Map<string, AmmConfig>();
      for (const pool of pools) {
        ammByPk.set(pool.poolState.ammConfig.toString(), pool.ammConfig);
      }

      if (ammByPk.size === 0) {
        return null;
      }

      let bestRoute: IGetBestQuoteResult | undefined = undefined;
      // Calculate based on base input or base output
      if (isBaseExactIn) {
        bestRoute = await getBestQuoteSingleHopExactIn({
          connection,
          pools: poolStates,
          ammByPk,
          inputMint,
          outputMint,
          amountIn: baseInput,
          slippageBps,
        });
      } else {
        bestRoute = await getBestQuoteSingleHopExactOut({
          connection,
          pools: poolStates,
          ammByPk,
          inputMint,
          outputMint,
          amountOut: baseInput,
          slippageBps,
        });
      }

      return bestRoute ? { ...bestRoute, isBaseExactIn: isBaseExactIn } : null;
    },
    enabled:
      !!baseInput &&
      baseInput !== "0" &&
      pools &&
      pools.length > 0 &&
      inputMint.toString() !== "" &&
      outputMint.toString() !== "",
    // UX stability: avoid flashing/loading state on each keystroke; keep last data while refetching
    // keepPreviousData: true,
    // Quotes are quickly stale but not instant; allow brief reuse to prevent thrash
    staleTime: 2_000,
    gcTime: 30_000,
    // Cancel in-flight quotes when params change
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
