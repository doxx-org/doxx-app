"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useRaydiumContext } from "@/lib/context/RaydiumContext";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useDoxxClmmProgram } from "@/lib/hooks/chain/useDoxxClmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetUserClmmPositions } from "@/lib/hooks/chain/useGetUserClmmPositions";
import { useGetUserCPMMPositions } from "@/lib/hooks/chain/useGetUserCpmmPositions";
import { useHarvestAllClmmRewards } from "@/lib/hooks/chain/useHarvestAllClmmRewards";
import { IPositionWithValue, RawPoolInfo } from "@/lib/hooks/chain/types";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { PositionSummaryCards } from "@/components/positions/PositionSummaryCards";
import {
  UnifiedPositionRow,
  mapClmmToUnified,
  mapCpmmToUnified,
} from "@/components/positions/types";
import { IUserCPMMPositionWithValue } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { toast } from "sonner";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Raydium,
  PositionUtils,
  TickUtils,
} from "@raydium-io/raydium-sdk-v2";
import { normalizeBN } from "@/lib/utils/number";

function useMultipleClmmPoolInfos(
  raydium: Raydium | undefined,
  poolIds: string[],
) {
  return useQueries({
    queries: poolIds.map((poolId) => ({
      queryKey: ["poolInfo", poolId],
      queryFn: async () => {
        if (!raydium || !poolId) return undefined;
        return raydium.clmm.getPoolInfoFromRpc(poolId);
      },
      enabled: !!raydium && !!poolId,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60,
    })),
  });
}

export default function PositionsPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();
  const { raydiumQuery, cpmmRaydiumQuery } = useRaydiumContext();
  const raydium = raydiumQuery.data;
  const cpmmRaydium = cpmmRaydiumQuery.data;

  const provider = useProvider({ connection, wallet });
  const doxxClmmProgram = useDoxxClmmProgram({ provider });

  const { data: allPools } = useGetAllPools();

  const {
    data: clmmPositionsRaw,
    isLoading: isLoadingClmm,
  } = useGetUserClmmPositions(
    raydium,
    doxxClmmProgram,
    wallet?.publicKey,
    allPools,
  );

  const {
    data: cpmmPositionsRaw,
    isLoading: isLoadingCpmm,
  } = useGetUserCPMMPositions(cpmmRaydium, wallet?.publicKey, allPools);

  // Build pool price map from all pools
  const poolPrices: Record<string, number> = useMemo(() => {
    if (!allPools) return {};
    return allPools.reduce(
      (acc, p) => {
        acc[p.lpToken.token1.address.toLowerCase()] =
          p.oraclePriceToken1Usd ?? p.priceToken1Usd;
        acc[p.lpToken.token2.address.toLowerCase()] =
          p.oraclePriceToken2Usd ?? p.priceToken2Usd;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [allPools]);

  // Map CLMM positions with value
  const clmmPositionsWithValue: IPositionWithValue[] = useMemo(() => {
    if (!clmmPositionsRaw || !allPools) return [];
    return clmmPositionsRaw.map((pos) => {
      const pool = allPools.find(
        (p) => p.poolId.toLowerCase() === pos.poolId.toBase58().toLowerCase(),
      );
      const tokenAValue =
        pos.amount0 *
        (poolPrices[pool?.lpToken.token1.address.toLowerCase() ?? ""] ?? 0);
      const tokenBValue =
        pos.amount1 *
        (poolPrices[pool?.lpToken.token2.address.toLowerCase() ?? ""] ?? 0);
      return { ...pos, positionValue: tokenAValue + tokenBValue };
    });
  }, [clmmPositionsRaw, allPools, poolPrices]);

  // Map CPMM positions with value
  const cpmmPositionsWithValue: IUserCPMMPositionWithValue[] = useMemo(() => {
    if (!cpmmPositionsRaw) return [];
    return cpmmPositionsRaw.map((pos) => {
      const pool = pos.pool;
      const tokenAValue =
        pos.amount0 *
        (poolPrices[pool.lpToken.token1.address.toLowerCase()] ?? 0);
      const tokenBValue =
        pos.amount1 *
        (poolPrices[pool.lpToken.token2.address.toLowerCase()] ?? 0);
      return { ...pos, positionValue: tokenAValue + tokenBValue };
    });
  }, [cpmmPositionsRaw, poolPrices]);

  // Get unique pool IDs for CLMM positions to fetch pool infos for harvest
  const uniqueClmmPoolIds = useMemo(() => {
    return Array.from(
      new Set(clmmPositionsWithValue.map((p) => p.poolId.toBase58())),
    );
  }, [clmmPositionsWithValue]);

  const poolInfoQueries = useMultipleClmmPoolInfos(raydium, uniqueClmmPoolIds);

  const poolInfoMap: Record<string, RawPoolInfo> = useMemo(() => {
    const map: Record<string, RawPoolInfo> = {};
    poolInfoQueries.forEach((q, i) => {
      if (q.data) {
        map[uniqueClmmPoolIds[i]] = q.data;
      }
    });
    return map;
  }, [poolInfoQueries, uniqueClmmPoolIds]);

  // Harvest hook
  const { harvest, isHarvesting } = useHarvestAllClmmRewards(raydium, wallet);

  // Unify positions — compute real pending fees via PositionUtils
  const unifiedPositions: UnifiedPositionRow[] = useMemo(() => {
    const clmmRows = clmmPositionsWithValue
      .map((pos) => {
        const pool = allPools?.find(
          (p) =>
            p.poolId.toLowerCase() === pos.poolId.toBase58().toLowerCase(),
        );
        if (!pool) return undefined;

        // Try to compute real pending fees using tick data from poolInfoMap
        let computedPendingFeesUsd: number | undefined;
        const rawPoolInfo = poolInfoMap[pos.poolId.toBase58()];
        if (rawPoolInfo) {
          try {
            const { computePoolInfo, tickData } = rawPoolInfo;
            const poolTickData = tickData[computePoolInfo.id.toBase58()];
            if (poolTickData) {
              const tickSpacing = computePoolInfo.ammConfig.tickSpacing;

              // Find the tick arrays containing tickLower and tickUpper
              const lowerStartIndex =
                TickUtils.getTickArrayStartIndexByTick(
                  pos.positionLayout.tickLower,
                  tickSpacing,
                );
              const upperStartIndex =
                TickUtils.getTickArrayStartIndexByTick(
                  pos.positionLayout.tickUpper,
                  tickSpacing,
                );

              const lowerTickArray = poolTickData[lowerStartIndex.toString()];
              const upperTickArray = poolTickData[upperStartIndex.toString()];

              if (lowerTickArray && upperTickArray) {
                const lowerOffset = Math.floor(
                  (pos.positionLayout.tickLower - lowerStartIndex) /
                    tickSpacing,
                );
                const upperOffset = Math.floor(
                  (pos.positionLayout.tickUpper - upperStartIndex) /
                    tickSpacing,
                );

                const tickLowerState = lowerTickArray.ticks[lowerOffset];
                const tickUpperState = upperTickArray.ticks[upperOffset];

                if (tickLowerState && tickUpperState) {
                  const { tokenFeeAmountA, tokenFeeAmountB } =
                    PositionUtils.GetPositionFeesV2(
                      computePoolInfo,
                      pos.positionLayout,
                      tickLowerState,
                      tickUpperState,
                    );

                  const decimals0 = pool.lpToken.token1.decimals;
                  const decimals1 = pool.lpToken.token2.decimals;
                  const price0 =
                    poolPrices[
                      pool.lpToken.token1.address.toLowerCase()
                    ] ?? 0;
                  const price1 =
                    poolPrices[
                      pool.lpToken.token2.address.toLowerCase()
                    ] ?? 0;

                  const feeA =
                    Number(normalizeBN(tokenFeeAmountA, decimals0)) * price0;
                  const feeB =
                    Number(normalizeBN(tokenFeeAmountB, decimals1)) * price1;

                  computedPendingFeesUsd = feeA + feeB;
                }
              }
            }
          } catch (err) {
            console.warn("Failed to compute pending fees for position:", err);
          }
        }

        return mapClmmToUnified(pos, pool, computedPendingFeesUsd);
      })
      .filter((r): r is UnifiedPositionRow => r !== undefined);

    const cpmmRows = cpmmPositionsWithValue.map((pos) =>
      mapCpmmToUnified(pos),
    );

    return [...clmmRows, ...cpmmRows];
  }, [clmmPositionsWithValue, cpmmPositionsWithValue, allPools, poolInfoMap, poolPrices]);

  // Summary stats
  const stats = useMemo(() => {
    const totalBalance = unifiedPositions.reduce(
      (sum, p) => sum + p.positionValue,
      0,
    );
    const totalPendingYield = unifiedPositions.reduce(
      (sum, p) => sum + p.totalPendingYieldUsd,
      0,
    );
    return {
      count: unifiedPositions.length,
      totalBalance,
      totalPendingYield,
    };
  }, [unifiedPositions]);

  const handleClaimYield = async () => {
    if (clmmPositionsWithValue.length === 0) return;
    try {
      const txId = await harvest({
        positions: clmmPositionsWithValue,
        poolInfos: poolInfoMap,
      });
      if (txId) {
        toast.success("Rewards claimed successfully");
        // Refetch positions and pool infos to update pending yield values
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["userPositionsWithPools"] }),
          queryClient.invalidateQueries({ queryKey: ["poolInfo"] }),
        ]);
      } else {
        toast.error("Wallet or SDK not ready. Please try again.");
      }
    } catch {
      toast.error("Failed to claim rewards");
    }
  };

  const isLoading = isLoadingClmm || isLoadingCpmm;
  const isWalletConnected = !!wallet?.publicKey;

  return (
    <div className="flex min-h-screen justify-center gap-16 p-8 sm:p-20 sm:pt-26">
      <div className="flex w-[1336px] flex-col gap-4 ">
        <div className="flex flex-row gap-4 justify-between items-center">
          <h1 className={cn(text.it1(), "text-green")}>Manage Your Positions</h1>
          {isWalletConnected && (
            <PositionSummaryCards
              positionCount={stats.count}
              totalBalance={stats.totalBalance}
              totalPendingYield={stats.totalPendingYield}
              onClaimYield={handleClaimYield}
              isClaimingYield={isHarvesting}
              hasClmmPositions={clmmPositionsWithValue.length > 0}
            />
          )}
        </div>
        {isWalletConnected ? (
          <PositionsTable data={unifiedPositions} isLoading={isLoading} />
        ) : (
          <div className="bg-black-800 flex h-[400px] items-center justify-center rounded-md border border-gray-800">
            <p className={cn(text.sb2(), "text-gray-600")}>
              Connect wallet to view positions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
