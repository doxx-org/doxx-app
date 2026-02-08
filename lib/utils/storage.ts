import { atomWithStorage } from "jotai/utils";
import { TradingPair } from "@/components/swap/pro/trading-pair-header/types";

/**
 * Atom for managing trading mode state across the application
 * true = PRO mode, false = LITE mode
 */

export enum TradingMode {
  LITE,
  PRO,
}

export const tradingModeAtom = atomWithStorage<TradingMode>(
  "tradingMode",
  TradingMode.LITE,
);

export const favouritePairsAtom = atomWithStorage<TradingPair[]>(
  "favouritePairs",
  [],
);

// Perf caches (module-level, survives hook re-renders)
// - Mint decimals/supply rarely change; cache them to avoid re-fetching on every refetch.
type MintSummary = {
  decimals: number;
  supply: bigint;
  isNftLike: boolean; // heuristic: decimals=0 + supply=1
};

export const mintSummaryCache = new Map<string, MintSummary>();
