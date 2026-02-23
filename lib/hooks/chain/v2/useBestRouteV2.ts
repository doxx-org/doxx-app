import { useMemo } from "react";
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
  ISwapStateV2,
  findBestClmmSwapBaseIn,
  findBestClmmSwapBaseOut,
} from "@/lib/utils/routingV2";
import { CLMMPoolStateWithConfig, CPMMPoolStateWithConfig } from "../types";

export type IUseBestRouteV2Response = {
  poolType: PoolType;
  pool: CPMMPoolStateWithConfig | CLMMPoolStateWithConfig;
  swapState: ISwapStateV2;
  remainingAccounts: PublicKey[];
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
};

export type IUseBestRouteV2Params = {
  raydium: Raydium | undefined;
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
      outputToken.address !== ""
    );
  }, [
    baseInput,
    cpmmPools,
    clmmPools,
    inputToken.address,
    outputToken.address,
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
          outputToken.address === "" ||
          !raydium
        )
          return null;

        const epochInfo = await raydium.fetchEpochInfo();

        // Calculate based on base input or base output
        if (isBaseExactIn) {
          const inputTokenDecimals = inputToken.decimals;
          // TODO: implement cpmm route
          const amountIn = parseAmountBN(baseInput, inputTokenDecimals);

          const clmmQuote = await findBestClmmSwapBaseIn({
            raydium,
            clmmPools,
            inputToken,
            outputToken,
            amountIn,
            epochInfo,
            slippageBps,
          });

          return {
            ...clmmQuote,
            poolType: PoolType.CLMM,
          };
        }

        const amountOut = parseAmountBN(baseInput, outputToken.decimals);
        const clmmQuote = await findBestClmmSwapBaseOut({
          raydium,
          clmmPools,
          amountOut,
          inputToken,
          outputToken,
          epochInfo,
          slippageBps,
        });

        return {
          ...clmmQuote,
          poolType: PoolType.CLMM,
        };
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
