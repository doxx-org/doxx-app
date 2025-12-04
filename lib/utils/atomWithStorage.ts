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
