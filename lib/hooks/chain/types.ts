import { BN, IdlAccounts } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmParsedRpcData,
  GetTransferAmountFee,
} from "@doxxorg/cpmm-sdk";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ClmmPositionLayout,
  ComputeClmmPoolInfo,
  PositionInfoLayout,
  ReturnTypeFetchMultiplePoolTickArrays,
  ReturnTypeGetLiquidityAmountOut,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import { Pool } from "@/components/earn/v2/types";
import { TokenProfile } from "@/lib/config/tokens";
import { DoxxClmmIdl, DoxxCpmmIdl } from "@/lib/idl";

export type CPMMAmmConfig = IdlAccounts<DoxxCpmmIdl>["ammConfig"];
export type CPMMPoolState = IdlAccounts<DoxxCpmmIdl>["poolState"];
export type CPMMObservationState = IdlAccounts<DoxxCpmmIdl>["observationState"];

export interface CPMMPoolStateWithConfig {
  poolId: PublicKey;
  poolState: CPMMPoolState;
  ammConfig: CPMMAmmConfig;
  observationState: CPMMObservationState | null | undefined;
}

export type CLMMAmmConfig = IdlAccounts<DoxxClmmIdl>["ammConfig"];
export type CLMMPoolState = IdlAccounts<DoxxClmmIdl>["poolState"];
export type CLMMObservationState = IdlAccounts<DoxxClmmIdl>["observationState"];
export type CLMMPersonalPositionState =
  IdlAccounts<DoxxClmmIdl>["personalPositionState"];

export interface RawPoolInfo {
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  computePoolInfo: ComputeClmmPoolInfo;
  tickData: ReturnTypeFetchMultiplePoolTickArrays;
}

export interface RawCPMMPoolInfo {
  poolInfo: ApiV3PoolInfoStandardItemCpmm;
  poolKeys: CpmmKeys;
  rpcData: CpmmParsedRpcData;
}

export interface CLMMPoolStateWithConfig {
  poolId: PublicKey;
  poolState: CLMMPoolState;
  ammConfig: CLMMAmmConfig;
  observationState: CLMMObservationState | null | undefined;
  // rawPoolInfo: RawPoolInfo;
}

export type SplBalance = {
  mint: string;
  rawAmount: bigint; // raw amount onchain
  amount: number; // simplified amount in human readable format
  decimals: number;
  tokenAccounts: string[]; // token account addresses used in the sum
};

export interface PoolToken {
  mint0Address: string;
  mint0Decimals: number;
  mint1Address: string;
  mint1Decimals: number;
}

// Token balance map by token address
export type BalanceMapByMint = Partial<Record<string, SplBalance>>; // token address -> SplBalance

export type PriceMap = Partial<Record<string, number>>; // token address -> price

// export interface PersonalPositionState {
//   publicKey: PublicKey;
//   account: CLMMPersonalPositionState;
// }

export interface PositionRewardInfo {
  rewardTokenProfile: TokenProfile | undefined;
  rewardMint: PublicKey;
  rewardDecimals: number;
  pendingAmount: number;
  pendingAmountRaw: BN;
  pendingValueUsd: number | undefined;
}

interface PositionFee {
  amount: number;
  valueUsd: number;
  amountRaw: BN;
  mint: PublicKey;
  decimals: number;
  tokenProfile: TokenProfile | undefined;
}

export interface PositionFees {
  token0: PositionFee;
  token1: PositionFee;
}

export interface UserPositionWithNFT {
  positionLayout: ClmmPositionLayout;
  nftTokenAccount: PublicKey;
  poolId: PublicKey;
  pool: CLMMPoolState; // Pool state
  amount0: number;
  amount1: number;
  fees: PositionFees;
  rewardInfos: PositionRewardInfo[];
}

export interface IPositionWithValue extends UserPositionWithNFT {
  positionValue: number;
}

export type PrepareOpenCLMMPositionData = ReturnTypeGetLiquidityAmountOut &
  RawPoolInfo;

export interface PrepareOpenCPMMPositionData extends RawCPMMPoolInfo {
  inputAmountFee: GetTransferAmountFee;
  anotherAmount: GetTransferAmountFee;
  maxAnotherAmount: GetTransferAmountFee;
  minAnotherAmount: GetTransferAmountFee;
  liquidity: BN;
}

export type PositionInfoLayout = ReturnType<typeof PositionInfoLayout.decode>;

export interface UserCPMMPosition {
  poolId: PublicKey;
  pool: Pool;
  rpcData: CpmmParsedRpcData;
  lpMint: PublicKey;
  lpTokenAccount: PublicKey;
  lpAmountRaw: BN;
  lpDecimals: number;
  userShare: number;
  amount0: number;
  amount1: number;
  amount0Raw: BN;
  amount1Raw: BN;
  /**
   * The user's proportional share of uncollected protocol/fund/creator fees
   * sitting in the pool vaults. LP trading fee earnings are already baked
   * into amount0/amount1 via reserve appreciation and are not separately
   * claimable per position.
   */
  fees: PositionFees;
  rewardInfos: PositionRewardInfo[];
}

export interface IUserCPMMPositionWithValue extends UserCPMMPosition {
  positionValue: number;
}
