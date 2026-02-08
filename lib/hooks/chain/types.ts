import { IdlAccounts } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
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

export interface CLMMPoolStateWithConfig {
  poolId: PublicKey;
  poolState: CLMMPoolState;
  ammConfig: CLMMAmmConfig;
  observationState: CLMMObservationState | null | undefined;
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
export type BalanceMapByMint = Partial<Record<string, SplBalance>>;

export type PriceMap = Partial<Record<string, number>>;
