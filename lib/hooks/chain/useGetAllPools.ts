import { useEffect, useMemo, useState } from "react";
import { getAccount } from "@solana/spl-token";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { BN } from "bn.js";
import { Pool, PoolType } from "@/components/earn/v2/types";
import { unknownToken } from "@/lib/config/tokens";
import { NATIVE_SOL_MINT, SOLANA_PRICE, ZERO } from "@/lib/constants";
import { calculateCLMMTokenPrices } from "@/lib/utils/calculation";
import { useOraclePrices } from "../useOraclePrices";
import { PoolToken } from "./types";
import { useDoxxClmmProgram } from "./useDoxxClmmProgram";
import { useDoxxCpmmProgram } from "./useDoxxCpmmProgram";
import { useGetAllTokenInfos } from "./useGetAllTokenInfos";
import { useGetCLMMPools } from "./useGetCLMMPools";
import { useGetCPMMPools } from "./useGetCPMMPools";
import { useProvider } from "./useProvider";

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

  const {
    data: prices,
    isLoading: isLoadingPrices,
    refetch: refetchPrices,
  } = useOraclePrices();

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
  }, [clmmPoolsData, cpmmPoolsData]);

  const {
    data: allTokenProfiles,
    isLoading: isLoadingAllTokenProfiles,
    refetch: refetchAllTokenProfiles,
  } = useGetAllTokenInfos({ poolTokens });

  const result = useQuery({
    queryKey: ["getAllPools"],
    queryFn: async (): Promise<Pool[] | undefined> => {
      const pools: Pool[] = [];

      // TODO: complete price fetching
      // Helper: USD price for each token when one side is SOL (using SOLANA_PRICE).
      // lpToken.token1 = token0, lpToken.token2 = token1.
      const usdPricesFromSolPair = (params: {
        token0Mint: string;
        token1Mint: string;
        priceToken0PerToken1: number;
        priceToken1PerToken0: number;
      }): { priceToken0Usd: number; priceToken1Usd: number } => {
        const {
          token0Mint,
          token1Mint,
          priceToken0PerToken1,
          priceToken1PerToken0,
        } = params;
        if (token0Mint === NATIVE_SOL_MINT) {
          return {
            priceToken0Usd: SOLANA_PRICE,
            priceToken1Usd: priceToken0PerToken1 * SOLANA_PRICE,
          };
        }
        if (token1Mint === NATIVE_SOL_MINT) {
          return {
            priceToken0Usd: (1 / priceToken1PerToken0) * SOLANA_PRICE,
            priceToken1Usd: SOLANA_PRICE,
          };
        }
        return { priceToken0Usd: 0, priceToken1Usd: 0 };
      };

      // const poolPriceUsdFromSolPair = (params: {
      //   token0Mint: string;
      //   token1Mint: string;
      //   priceToken1PerToken0: number;
      // }): number | undefined => {
      //   const { token0Mint, token1Mint, priceToken1PerToken0 } = params;
      //   if (token0Mint === NATIVE_SOL_MINT)
      //     return priceToken1PerToken0 * SOLANA_PRICE;
      //   if (token1Mint === NATIVE_SOL_MINT)
      //     return (1 / priceToken1PerToken0) * SOLANA_PRICE;
      //   return undefined;
      // };

      // CPMM: price from vault reserves
      for (const poolData of cpmmPoolsData ?? []) {
        const { poolState, ammConfig } = poolData;

        const token0Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token0Mint.toBase58(),
        ) ?? { ...unknownToken, address: poolState.token0Mint.toBase58() };
        const token1Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token1Mint.toBase58(),
        ) ?? { ...unknownToken, address: poolState.token1Mint.toBase58() };

        let priceToken1PerToken0 = 0;
        try {
          const [vault0Account, vault1Account] = await Promise.all([
            getAccount(connection, poolState.token0Vault),
            getAccount(connection, poolState.token1Vault),
          ]);
          const reserve0 = new BN(vault0Account.amount.toString())
            .sub(poolState.protocolFeesToken0)
            .sub(poolState.fundFeesToken0)
            .sub(
              poolState.enableCreatorFee ? poolState.creatorFeesToken0 : ZERO,
            );
          const reserve1 = new BN(vault1Account.amount.toString())
            .sub(poolState.protocolFeesToken1)
            .sub(poolState.fundFeesToken1)
            .sub(
              poolState.enableCreatorFee ? poolState.creatorFeesToken1 : ZERO,
            );
          if (reserve0.gt(ZERO) && reserve1.gt(ZERO)) {
            const dec0 = poolState.mint0Decimals;
            const dec1 = poolState.mint1Decimals;
            priceToken1PerToken0 =
              reserve1.toNumber() /
              10 ** dec1 /
              (reserve0.toNumber() / 10 ** dec0);
          }
        } catch {
          // leave 0 on vault fetch error
        }

        const priceToken0PerToken1 =
          priceToken1PerToken0 > 0 ? 1 / priceToken1PerToken0 : 0;
        const priceAperB = priceToken0PerToken1; // lpToken.token1 = token0, token2 = token1 → A/B = token0/token1
        const priceBperA = priceToken1PerToken0;
        const { priceToken0Usd, priceToken1Usd } = usdPricesFromSolPair({
          token0Mint: poolState.token0Mint.toBase58(),
          token1Mint: poolState.token1Mint.toBase58(),
          priceToken0PerToken1,
          priceToken1PerToken0,
        });

        const oraclePriceToken1Usd = prices?.[token0Profile.address];
        const oraclePriceToken2Usd = prices?.[token1Profile.address];

        pools.push({
          poolId: poolData.poolId.toString(),
          fee: ammConfig.tradeFeeRate,
          lpToken: { token1: token0Profile, token2: token1Profile },
          apr: 10,
          tvl: 0,
          dailyVol: 0,
          dailyVolperTvl: 0,
          reward24h: 0.001,
          cpmmPoolState: poolState,
          oraclePriceToken1Usd,
          oraclePriceToken2Usd,
          priceAperB,
          priceBperA,
          priceToken1Usd: priceToken0Usd,
          priceToken2Usd: priceToken1Usd,
          poolType: PoolType.CPMM,
        });
      }

      // CLMM: price from sqrtPriceX64
      for (const poolData of clmmPoolsData ?? []) {
        const { poolState, ammConfig } = poolData;

        const token0Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.tokenMint0.toBase58(),
        ) ?? { ...unknownToken, address: poolState.tokenMint0.toBase58() };
        const token1Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.tokenMint1.toBase58(),
        ) ?? { ...unknownToken, address: poolState.tokenMint1.toBase58() };

        const { priceToken1PerToken0, priceToken0PerToken1 } =
          calculateCLMMTokenPrices({
            sqrtPriceX64: new BN(poolState.sqrtPriceX64.toString()),
            decimalsToken0: poolState.mintDecimals0,
            decimalsToken1: poolState.mintDecimals1,
          });

        const priceAperB = priceToken0PerToken1;
        const priceBperA = priceToken1PerToken0;
        const { priceToken0Usd, priceToken1Usd } = usdPricesFromSolPair({
          token0Mint: poolState.tokenMint0.toBase58(),
          token1Mint: poolState.tokenMint1.toBase58(),
          priceToken0PerToken1,
          priceToken1PerToken0,
        });
        const oraclePriceToken1Usd = prices?.[token0Profile.address];
        const oraclePriceToken2Usd = prices?.[token1Profile.address];

        pools.push({
          poolId: poolData.poolId.toString(),
          fee: new BN(ammConfig.tradeFeeRate.toString()),
          lpToken: { token1: token0Profile, token2: token1Profile },
          apr: 10,
          tvl: 0,
          dailyVol: 0,
          dailyVolperTvl: 0,
          reward24h: 0.001,
          clmmPoolState: poolState,
          oraclePriceToken1Usd,
          oraclePriceToken2Usd,
          priceAperB,
          priceBperA,
          priceToken1Usd: priceToken0Usd,
          priceToken2Usd: priceToken1Usd,
          poolType: PoolType.CLMM,
        });
      }

      return pools;
    },
    refetchOnWindowFocus: false,
    enabled: !(
      isLoadingCpmmPools ||
      isLoadingClmmPools ||
      isLoadingAllTokenProfiles ||
      isLoadingPrices
    ),
    refetchInterval: 15 * 1000, // 15 seconds
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 60 seconds
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (result.isFetched) {
      // eslint-disable-next-line
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
      refetchPrices();
      result.refetch();
    },
    cpmmPoolsData,
    clmmPoolsData,
  };
}
