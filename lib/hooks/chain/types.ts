import { IdlAccounts } from "@coral-xyz/anchor";
import { DoxxAmm } from "@/lib/idl/doxxIdl";

export type AmmConfig = IdlAccounts<DoxxAmm>["ammConfig"];
export type PoolState = IdlAccounts<DoxxAmm>["poolState"];
export type ObservationState = IdlAccounts<DoxxAmm>["observationState"];

export interface PoolStateWithConfig {
  poolState: PoolState;
  ammConfig: AmmConfig;
  observationState: ObservationState;
}

export type SplBalance = {
  mint: string;
  rawAmount: bigint; // raw amount onchain
  amount: number; // simplified amount in human readable format
  decimals: number;
  tokenAccounts: string[]; // token account addresses used in the sum
};

// Token balance map by token address
export type BalanceMapByMint = Partial<Record<string, SplBalance>>;
