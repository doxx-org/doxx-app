import { useMemo } from "react";
import { PoolUtils, Raydium } from "@raydium-io/raydium-sdk-v2";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { PriceMode } from "@/components/earn/v2/types";
import { TokenProfile } from "@/lib/config/tokens";
import { DEFAULT_CREATE_CLMM_SLIPPAGE } from "@/lib/constants";
import { parseAmountBN } from "@/lib/utils";
import { getTickRangeFromPriceMode } from "@/lib/utils/decode";
import { PrepareOpenCLMMPositionData } from "../types";

interface UsePrepareOpenCLMMPositionParams {
  poolId: string;
  baseIn: boolean;
  baseToken: TokenProfile;
  baseAmount: string;
  priceMode: PriceMode;
  minPriceAperB?: string;
  maxPriceAperB?: string;
  raydium: Raydium | undefined;
}

export const usePrepareOpenCLMMPosition = ({
  poolId,
  baseIn,
  baseToken,
  baseAmount,
  priceMode,
  minPriceAperB,
  maxPriceAperB,
  raydium,
}: UsePrepareOpenCLMMPositionParams): UseQueryResult<
  PrepareOpenCLMMPositionData | undefined,
  Error
> => {
  const isEnabled = useMemo(() => {
    return (
      poolId !== "" &&
      raydium !== undefined &&
      baseToken !== undefined &&
      baseAmount !== "" &&
      priceMode !== undefined &&
      minPriceAperB !== undefined &&
      maxPriceAperB !== undefined
    );
  }, [
    poolId,
    raydium,
    baseToken,
    baseAmount,
    priceMode,
    minPriceAperB,
    maxPriceAperB,
  ]);

  return useQuery({
    queryKey: [
      "prepareOpenCLMMPosition",
      poolId,
      baseIn,
      baseToken,
      baseAmount,
      priceMode,
      minPriceAperB,
      maxPriceAperB,
    ],
    queryFn: async () => {
      if (!raydium || poolId === "") return undefined;
      const poolInfo = await raydium.clmm.getPoolInfoFromRpc(poolId);

      const tickSpacing = poolInfo.poolInfo.config.tickSpacing;

      const [lowerTick, upperTick] = getTickRangeFromPriceMode(
        priceMode,
        tickSpacing,
        poolInfo.poolInfo,
        baseIn,
        minPriceAperB,
        maxPriceAperB,
      );

      const epochInfo = await raydium.fetchEpochInfo();
      // Calculate required liquidity and other token amount
      const liquidityCalc = await PoolUtils.getLiquidityAmountOutFromAmountIn({
        poolInfo: poolInfo.poolInfo,
        slippage: DEFAULT_CREATE_CLMM_SLIPPAGE, // Use buffer as slippage
        inputA: baseIn,
        tickUpper: Math.max(lowerTick, upperTick),
        tickLower: Math.min(lowerTick, upperTick),
        amount: parseAmountBN(baseAmount, baseToken.decimals),
        add: true,
        amountHasFee: true,
        epochInfo,
      });

      return { ...liquidityCalc, ...poolInfo };
    },
    enabled: isEnabled,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 1, // 1 minute
  });
};
