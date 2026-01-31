import { TokenProfile } from "@/lib/config/tokens";
import { CLMMPoolState, CPMMPoolState } from "@/lib/hooks/chain/types";
import BN from "bn.js";

export enum PoolType {
  CLMM = "CLMM",
  CPMM = "CPMM",
}

export enum PriceMode {
  FULL = "Full",
  CUSTOM = "Custom",
}

export type Pool = {
  poolId: string;
  fee: BN;
  lpToken: {
    token1: TokenProfile;
    token2: TokenProfile;
  };
  apr: number; // in percentage
  tvl: number; // in usd
  dailyVol: number; // in usd
  dailyVolperTvl: number; // in percentage
  reward24h: number; // in usd
  cpmmPoolState?: CPMMPoolState;
  clmmPoolState?: CLMMPoolState;
  price: number;
  poolType: PoolType;
};
