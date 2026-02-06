import { Pool, PoolType } from "@/components/earn/v2/types";
import { useQuery } from "@tanstack/react-query";
import { useGetCPMMPools } from "./useGetCPMMPools";
import { useGetCLMMPools } from "./useGetCLMMPools";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useDoxxCpmmProgram } from "./useDoxxCpmmProgram";
import { useProvider } from "./useProvider";
import { useDoxxClmmProgram } from "./useDoxxClmmProgram";
import { unknownToken } from "@/lib/config/tokens";
import { useGetAllTokenInfos } from "./useGetAllTokenInfos";
import { useEffect, useMemo, useState } from "react";
import { PoolToken } from "./types";
import { BN } from "bn.js";

export function useGetAllPools() {
  const [isLoading, setIsLoading] = useState(true);
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxCpmmProgram = useDoxxCpmmProgram({ provider });
  const doxxClmmProgram = useDoxxClmmProgram({ provider });

  // Fetch all pools
  const {
    data: cpmmPoolsData,
    isLoading: isLoadingCpmmPools,
    refetch: refetchCpmmPoolStates,
  } = useGetCPMMPools(doxxCpmmProgram);

  const {
    data: clmmPoolsData,
    isLoading: isLoadingClmmPools,
    refetch: refetchClmmPoolStates,
  } = useGetCLMMPools(doxxClmmProgram);

  const poolTokens: PoolToken[] = useMemo(() => {
    if (!cpmmPoolsData || !clmmPoolsData) return [];

    const cpmmPoolTokens: PoolToken[] = cpmmPoolsData.map((p) => {
      return {
        mint0Address: p.poolState.token0Mint.toString(),
        mint0Decimals: p.poolState.mint0Decimals,
        mint1Address: p.poolState.token1Mint.toString(),
        mint1Decimals: p.poolState.mint1Decimals,
      };
    });

    const clmmPoolTokens: PoolToken[] = clmmPoolsData.map((p) => {
      return {
        mint0Address: p.poolState.tokenMint0.toString(),
        mint0Decimals: p.poolState.mintDecimals0,
        mint1Address: p.poolState.tokenMint1.toString(),
        mint1Decimals: p.poolState.mintDecimals1,
      };
    });

    return [...cpmmPoolTokens, ...clmmPoolTokens];
  }, [clmmPoolsData]);

  const { data: allTokenProfiles, isLoading: isLoadingAllTokenProfiles, refetch: refetchAllTokenProfiles } =
    useGetAllTokenInfos({ poolTokens });

  const result = useQuery({
    queryKey: ["getAllPools"],
    queryFn: async (): Promise<Pool[] | undefined> => {
      const cpmmPools: Pool[] | undefined = cpmmPoolsData?.map((poolData) => {
        const { poolState, ammConfig } = poolData;

        // Find token profiles
        const token0Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token0Mint.toBase58(),
        ) ?? {
          ...unknownToken,
          address: poolState.token0Mint.toBase58(),
        };
        const token1Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token1Mint.toBase58(),
        ) ?? {
          ...unknownToken,
          address: poolState.token1Mint.toBase58(),
        };

        const poolAddress = poolData.observationState.poolId;

        return {
          poolId: poolAddress.toBase58(),
          fee: ammConfig.tradeFeeRate,
          lpToken: {
            token1: token0Profile,
            token2: token1Profile,
          },
          apr: 10, // Placeholder - calculate from fees/TVL
          tvl: 0, // Placeholder - fetch from vault balances
          dailyVol: 0, // Placeholder - fetch from analytics
          dailyVolperTvl: 0, // Placeholder
          reward24h: 0.001, // Placeholder - fetch from analytics
          cpmmPoolState: poolState, // IMPORTANT: Include the actual pool state for deposit
          // TODO: fetch from pool state
          price: 0.301,
          poolType: PoolType.CPMM, // Randomly assign pool type
        };
      });

      const clmmPools: Pool[] | undefined = clmmPoolsData?.map((poolData) => {
        const { poolState, ammConfig } = poolData;

        // Find token profiles
        const token0Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.tokenMint0.toBase58(),
        ) ?? {
          ...unknownToken,
          address: poolState.tokenMint0.toBase58(),
        };
        const token1Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.tokenMint1.toBase58(),
        ) ?? {
          ...unknownToken,
          address: poolState.tokenMint1.toBase58(),
        };

        const poolAddress = poolData.observationState.poolId;

        return {
          poolId: poolAddress.toBase58(),
          fee: new BN(ammConfig.tradeFeeRate.toString()),
          lpToken: {
            token1: token0Profile,
            token2: token1Profile,
          },
          apr: 10, // Placeholder - calculate from fees/TVL
          tvl: 0, // Placeholder - fetch from vault balances
          dailyVol: 0, // Placeholder - fetch from analytics
          dailyVolperTvl: 0, // Placeholder
          reward24h: 0.001, // Placeholder - fetch from analytics
          clmmPoolState: poolState, // IMPORTANT: Include the actual pool state for deposit
          // TODO: fetch from pool state
          price: 0.301,
          poolType: PoolType.CLMM, // Randomly assign pool type
        };
      });

      return [...(cpmmPools ?? []), ...(clmmPools ?? [])];
    },
    refetchOnWindowFocus: false,
    enabled: !(isLoadingCpmmPools || isLoadingClmmPools || isLoadingAllTokenProfiles),
    refetchInterval: 15 * 1000, // 15 seconds
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 60 seconds
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (result.isFetched) {
      setIsLoading(false);
    }
  }, [result.isFetched]);

  return {
    data: result.data,
    isLoading,
    refetch: () => {
      setIsLoading(true);
      refetchCpmmPoolStates();
      refetchClmmPoolStates();
      refetchAllTokenProfiles();
      result.refetch();
    },
    cpmmPoolsData,
    clmmPoolsData
  };
}