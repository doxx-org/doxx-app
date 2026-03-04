import { useMemo } from "react";
import { Percent, Raydium } from "@doxxorg/cpmm-sdk";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TokenProfile } from "@/lib/config/tokens";
import { BPS, DEFAULT_CREATE_CPMM_SLIPPAGE } from "@/lib/constants";
import { PrepareOpenCPMMPositionData } from "../types";

interface usePrepareOpenCPMMPositionParams {
  poolId: string;
  baseIn: boolean;
  baseToken: TokenProfile;
  baseUiAmount: string;
  raydium: Raydium | undefined;
}

export const usePrepareOpenCPMMPosition = ({
  poolId,
  baseIn,
  baseToken,
  baseUiAmount,
  raydium,
}: usePrepareOpenCPMMPositionParams): UseQueryResult<
  PrepareOpenCPMMPositionData | undefined,
  Error
> => {
  const isEnabled = useMemo(() => {
    return (
      poolId !== "" &&
      raydium !== undefined &&
      baseToken !== undefined &&
      baseUiAmount !== ""
    );
  }, [poolId, raydium, baseToken, baseUiAmount]);

  return useQuery({
    queryKey: [
      "prepareOpenCPMMPosition",
      poolId,
      baseIn,
      baseToken,
      baseUiAmount,
    ],
    queryFn: async () => {
      if (!raydium || poolId === "") return undefined;
      const rawPoolInfo = await raydium.cpmm.getPoolInfoFromRpc(poolId);

      const poolInfo = rawPoolInfo.poolInfo;
      const baseReserve = rawPoolInfo.rpcData.baseReserve;
      const quoteReserve = rawPoolInfo.rpcData.quoteReserve;

      const epochInfo = await raydium.fetchEpochInfo();

      // Calculate required liquidity and other token amount
      const liquidityCalc = raydium.cpmm.computePairAmount({
        baseReserve,
        quoteReserve,
        poolInfo,
        amount: baseUiAmount,
        slippage: new Percent(DEFAULT_CREATE_CPMM_SLIPPAGE * BPS, BPS),
        baseIn,
        epochInfo,
      });
      return { ...liquidityCalc, ...rawPoolInfo };
    },
    enabled: isEnabled,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 1, // 1 minute
  });
};
