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
