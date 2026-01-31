import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/constants";
import { simplifyRoutingErrorMsg } from "@/lib/utils/errors/routing-error";
import {
  IGetBestQuoteResult,
  SwapState,
  getBestQuoteSingleHopExactIn,
  getBestQuoteSingleHopExactOut,
} from "../../utils/routing";
import { CPMMPoolStateWithConfig } from "./types";

export type IUseBestRouteResponse = {
  pool: CPMMPoolStateWithConfig;
  swapState: SwapState;
};

export type IUseBestRouteParams = {
  connection: Connection;
  inputMint: PublicKey;
  outputMint: PublicKey;
  baseInput: string;
  pools: CPMMPoolStateWithConfig[] | undefined;
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
      try {
        if (
          !baseInput ||
          baseInput === "0" ||
          !pools ||
          pools.length === 0 ||
          inputMint.toString() === "" ||
          outputMint.toString() === ""
        )
          return null;

        let bestRoute: IGetBestQuoteResult | undefined = undefined;
        // Calculate based on base input or base output
        if (isBaseExactIn) {
          const exactInBestRoute = await getBestQuoteSingleHopExactIn({
            connection,
            pools,
            // ammByPk,
            inputMint,
            outputMint,
            amountIn: baseInput,
            slippageBps,
          });

          if (exactInBestRoute) {
            bestRoute = {
              ...exactInBestRoute,
              swapState: {
                ...exactInBestRoute.swapState,
                minMaxAmount: exactInBestRoute.swapState.minAmountOut,
              },
            };
          }
        } else {
          const exactOutBestRoute = await getBestQuoteSingleHopExactOut({
            connection,
            pools,
            // ammByPk,
            inputMint,
            outputMint,
            amountOut: baseInput,
            slippageBps,
          });

          if (exactOutBestRoute) {
            bestRoute = {
              ...exactOutBestRoute,
              swapState: {
                ...exactOutBestRoute.swapState,
                minMaxAmount: exactOutBestRoute.swapState.maxAmountIn,
              },
            };
          }
        }

        return bestRoute
          ? {
            pool: bestRoute.pool,
            swapState: {
              ...bestRoute.swapState,
              isBaseExactIn,
            },
          }
          : null;
      } catch (error) {
        throw new Error(simplifyRoutingErrorMsg(error));
      }
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
    staleTime: 10_000,
    gcTime: 30_000,
    // Cancel in-flight quotes when params change
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
