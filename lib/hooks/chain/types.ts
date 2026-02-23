import { BN, IdlAccounts } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  ReturnTypeFetchMultiplePoolTickArrays,
  ReturnTypeGetLiquidityAmountOut,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
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

interface RawPoolInfo {
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  computePoolInfo: ComputeClmmPoolInfo;
  tickData: ReturnTypeFetchMultiplePoolTickArrays;
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

export interface PersonalPositionState {
  publicKey: PublicKey;
  account: CLMMPersonalPositionState;
}

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

export interface UserPositionWithNFT extends PersonalPositionState {
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
