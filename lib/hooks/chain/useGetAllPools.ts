import { useMemo } from "react";
import { unpackAccount } from "@solana/spl-token";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { BN } from "bn.js";
import { Pool, PoolType } from "@/components/earn/v2/types";
import { solana, unknownToken } from "@/lib/config/tokens";
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

  const poolTokens: PoolToken[] | undefined = useMemo(() => {
    if (!cpmmPoolsData || !clmmPoolsData) return undefined;

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

  // Stable fingerprints so the query reruns when the pool set changes
  const cpmmPoolIds = useMemo(
    () =>
      cpmmPoolsData
        ?.map((p) => p.poolId.toBase58())
        .sort()
        .join(",") ?? "",
    [cpmmPoolsData],
  );
  const clmmPoolIds = useMemo(
    () =>
      clmmPoolsData
        ?.map((p) => p.poolId.toBase58())
        .sort()
        .join(",") ?? "",
    [clmmPoolsData],
  );

  const result = useQuery({
    queryKey: ["getAllPools", cpmmPoolIds, clmmPoolIds],
    queryFn: async (): Promise<Pool[] | undefined> => {
      const pools: Pool[] = [];
      // Below this USD threshold the pool is effectively empty (dust reserves).
      // Dividing volume by such a tiny TVL produces meaningless ratios.
      const MIN_TVL_USD = 1;

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
            priceToken0Usd: prices?.[solana.address] ?? SOLANA_PRICE,
            priceToken1Usd:
              priceToken0PerToken1 * (prices?.[solana.address] ?? SOLANA_PRICE),
          };
        }
        if (token1Mint === NATIVE_SOL_MINT) {
          return {
            priceToken0Usd:
              (1 / priceToken1PerToken0) *
              (prices?.[solana.address] ?? SOLANA_PRICE),
            priceToken1Usd: prices?.[solana.address] ?? SOLANA_PRICE,
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

      // Batch-fetch every vault across all pools in a single RPC round-trip.
      const cpmmPools = cpmmPoolsData ?? [];
      const clmmPools = clmmPoolsData ?? [];

      const allVaultAddresses = [
        ...cpmmPools.flatMap((p) => [
          p.poolState.token0Vault,
          p.poolState.token1Vault,
        ]),
        ...clmmPools.flatMap((p) => [
          p.poolState.tokenVault0,
          p.poolState.tokenVault1,
        ]),
      ];

      const clmmVaultOffset = cpmmPools.length * 2;

      let allVaultInfos: Awaited<
        ReturnType<typeof connection.getMultipleAccountsInfo>
      >[number][] = new Array(allVaultAddresses.length).fill(null);

      try {
        allVaultInfos = await connection.getMultipleAccountsInfo(
          allVaultAddresses,
          "confirmed",
        );
      } catch {
        // allVaultInfos stays null-filled; reserves will be 0
      }

      // CPMM: price from vault reserves
      for (let i = 0; i < cpmmPools.length; i++) {
        const poolData = cpmmPools[i];
        const { poolState, ammConfig } = poolData;

        const token0Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token0Mint.toBase58(),
        ) ?? { ...unknownToken, address: poolState.token0Mint.toBase58() };
        const token1Profile = allTokenProfiles?.find(
          (t) => t.address === poolState.token1Mint.toBase58(),
        ) ?? { ...unknownToken, address: poolState.token1Mint.toBase58() };

        let priceToken1PerToken0 = 0;
        let reserve0Human = 0;
        let reserve1Human = 0;

        try {
          const info0 = allVaultInfos[i * 2];
          const info1 = allVaultInfos[i * 2 + 1];
          if (info0 && info1) {
            const vault0Account = unpackAccount(poolState.token0Vault, info0);
            const vault1Account = unpackAccount(poolState.token1Vault, info1);
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
              reserve0Human = reserve0.toNumber() / 10 ** dec0;
              reserve1Human = reserve1.toNumber() / 10 ** dec1;
              priceToken1PerToken0 = reserve1Human / reserve0Human;
            }
          }
        } catch {
          // leave 0 on vault parse error
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

        const bestPrice0Usd = oraclePriceToken1Usd ?? priceToken0Usd;
        const bestPrice1Usd = oraclePriceToken2Usd ?? priceToken1Usd;
        const tvl =
          reserve0Human * bestPrice0Usd + reserve1Human * bestPrice1Usd;

        pools.push({
          poolId: poolData.poolId.toString(),
          fee: ammConfig.tradeFeeRate,
          lpToken: { token1: token0Profile, token2: token1Profile },
          apr: 0,
          tvl,
          dailyVol: 0,
          dailyVolperTvl: 0,
          reward24h: 0,
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
      for (let i = 0; i < clmmPools.length; i++) {
        const poolData = clmmPools[i];
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

        const bestPrice0Usd = oraclePriceToken1Usd ?? priceToken0Usd;
        const bestPrice1Usd = oraclePriceToken2Usd ?? priceToken1Usd;

        let tvl = 0;
        try {
          const info0 = allVaultInfos[clmmVaultOffset + i * 2];
          const info1 = allVaultInfos[clmmVaultOffset + i * 2 + 1];
          if (info0 && info1) {
            const vault0Account = unpackAccount(poolState.tokenVault0, info0);
            const vault1Account = unpackAccount(poolState.tokenVault1, info1);
            const reserve0 = new BN(vault0Account.amount.toString())
              .sub(new BN(poolState.protocolFeesToken0.toString()))
              .sub(new BN(poolState.fund_fees_token_0.toString()));
            const reserve1 = new BN(vault1Account.amount.toString())
              .sub(new BN(poolState.protocolFeesToken1.toString()))
              .sub(new BN(poolState.fund_fees_token_1.toString()));
            if (reserve0.gten(0) && reserve1.gten(0)) {
              const reserve0Human =
                reserve0.toNumber() / 10 ** poolState.mintDecimals0;
              const reserve1Human =
                reserve1.toNumber() / 10 ** poolState.mintDecimals1;
              tvl =
                reserve0Human * bestPrice0Usd + reserve1Human * bestPrice1Usd;
            }
          }
        } catch {
          // leave tvl at 0 on vault parse error
        }

        pools.push({
          poolId: poolData.poolId.toString(),
          fee: new BN(ammConfig.tradeFeeRate.toString()),
          lpToken: { token1: token0Profile, token2: token1Profile },
          apr: 0,
          tvl,
          dailyVol: 0,
          dailyVolperTvl: 0,
          reward24h: 0,
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

      // Fetch volume from backend (only uncached pools are requested by the API)
      try {
        const volumeRes = await fetch("/api/indexer/volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pools: pools.map((p) => ({
              poolId: p.poolId,
              mint0: p.lpToken.token1.address,
              mint1: p.lpToken.token2.address,
            })),
          }),
        });
        if (volumeRes.ok) {
          const { volumes } = (await volumeRes.json()) as {
            volumes: Record<
              string,
              { volumeBase: number; volumeQuote: number }
            >;
          };
          for (const pool of pools) {
            const vol = volumes[pool.poolId];
            if (vol) {
              const priceToken1 = pool.priceToken1Usd ?? 0;
              const priceToken2 = pool.priceToken2Usd ?? 0;
              pool.dailyVol =
                vol.volumeBase * priceToken1 + vol.volumeQuote * priceToken2;
              pool.dailyVolperTvl =
                pool.tvl >= MIN_TVL_USD ? (pool.dailyVol / pool.tvl) * 100 : 0;
            }
          }
        }
      } catch {
        // leave dailyVol/dailyVolperTvl at 0 on volume fetch error
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

  // Loading until all deps have loaded and the aggregated query has completed at least once
  const isLoading =
    isLoadingCpmmPools ||
    isLoadingClmmPools ||
    isLoadingAllTokenProfiles ||
    isLoadingPrices ||
    !result.isFetched;

  return {
    data: result.data,
    isLoading,
    refetch: () => {
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
