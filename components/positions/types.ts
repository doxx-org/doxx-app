import { TokenProfile } from "@/lib/config/tokens";
import {
  IPositionWithValue,
  IUserCPMMPositionWithValue,
  PositionFees,
  PositionRewardInfo,
} from "@/lib/hooks/chain/types";
import { Pool, PoolType } from "@/components/earn/v2/types";

export interface UnifiedPositionRow {
  id: string; // nftMint (CLMM) or `cpmm-${poolId}` (CPMM)
  poolId: string;
  poolType: PoolType;
  token1: TokenProfile;
  token2: TokenProfile;
  feeBps: string; // from pool.fee via normalizeBPSString
  positionValue: number; // USD
  amount0: number;
  amount1: number;
  apr: number | undefined; // from pool.apr
  totalPendingYieldUsd: number; // fees + rewards USD
  fees: PositionFees;
  rewardInfos: PositionRewardInfo[];
  // CLMM range data
  isClmm: boolean;
  tickLower?: number;
  tickUpper?: number;
  currentTick?: number;
  isInRange: boolean; // CLMM: tickLower <= currentTick < tickUpper; CPMM: always true
  positionAddress: string; // nftMint (CLMM) or lpMint (CPMM)
  pool: Pool; // original Pool for reference
}

export function mapClmmToUnified(
  pos: IPositionWithValue,
  pool: Pool,
  computedPendingFeesUsd?: number,
): UnifiedPositionRow {
  const nftMint = pos.positionLayout.nftMint.toBase58();
  const tickLower = pos.positionLayout.tickLower;
  const tickUpper = pos.positionLayout.tickUpper;
  const currentTick = pool.clmmPoolState?.tickCurrent;

  // Use computed pending fees if available, otherwise fall back to stale on-chain values
  const feesUsd =
    computedPendingFeesUsd ?? pos.fees.token0.valueUsd + pos.fees.token1.valueUsd;
  const rewardsUsd = pos.rewardInfos.reduce(
    (sum, r) => sum + (r.pendingValueUsd ?? 0),
    0,
  );

  return {
    id: nftMint,
    poolId: pool.poolId,
    poolType: PoolType.CLMM,
    token1: pool.lpToken.token1,
    token2: pool.lpToken.token2,
    feeBps: pool.fee.toString(),
    positionValue: pos.positionValue,
    amount0: pos.amount0,
    amount1: pos.amount1,
    apr: pool.apr,
    totalPendingYieldUsd: feesUsd + rewardsUsd,
    fees: pos.fees,
    rewardInfos: pos.rewardInfos,
    isClmm: true,
    tickLower,
    tickUpper,
    currentTick: currentTick,
    isInRange:
      currentTick !== undefined
        ? tickLower <= currentTick && currentTick < tickUpper
        : false,
    positionAddress: nftMint,
    pool,
  };
}

export function mapCpmmToUnified(
  pos: IUserCPMMPositionWithValue,
): UnifiedPositionRow {
  const pool = pos.pool;
  const feesUsd = pos.fees.token0.valueUsd + pos.fees.token1.valueUsd;
  const rewardsUsd = pos.rewardInfos.reduce(
    (sum, r) => sum + (r.pendingValueUsd ?? 0),
    0,
  );

  return {
    id: `cpmm-${pool.poolId}`,
    poolId: pool.poolId,
    poolType: PoolType.CPMM,
    token1: pool.lpToken.token1,
    token2: pool.lpToken.token2,
    feeBps: pool.fee.toString(),
    positionValue: pos.positionValue,
    amount0: pos.amount0,
    amount1: pos.amount1,
    apr: pool.apr,
    totalPendingYieldUsd: feesUsd + rewardsUsd,
    fees: pos.fees,
    rewardInfos: pos.rewardInfos,
    isClmm: false,
    isInRange: true, // CPMM is always full range
    positionAddress: pos.lpMint.toBase58(),
    pool,
  };
}
