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
  price: number; // pool display price (usd when SOL in pair, else ratio)
  priceAperB: number; // tokenA (token1) per tokenB (token2)
  priceBperA: number; // tokenB (token2) per tokenA (token1)
  /** USD price of 1 unit of token1 (first token in lpToken). */
  priceToken1Usd: number;
  /** USD price of 1 unit of token2 (second token in lpToken). */
  priceToken2Usd: number;
  poolType: PoolType;
};
