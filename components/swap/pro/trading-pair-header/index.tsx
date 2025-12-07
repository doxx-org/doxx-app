"use client";

import { FavouritePair } from "./FavouritePair";
import { MarketDropdown } from "./MarketDropdown";
import { MarketInfoPanel } from "./MarketInfoPanel";
import { MarketType, TradingPair } from "./types";

interface TradingPairHeaderProps {
  selectedPair: TradingPair;
  onSelect: (pair: TradingPair) => void;
  onMarketTypeChange: (value: MarketType) => void;
}

export function TradingPairHeader({
  selectedPair,
  onSelect,
  onMarketTypeChange,
}: TradingPairHeaderProps) {
  return (
    <div className="bg-black-900 relative top-14 z-40 flex flex-col border-b-2 border-gray-800">
      {/* Main Trading Pair Info */}
      <div className="flex flex-row items-center border-b-2 border-gray-800">
        <MarketDropdown selectedPair={selectedPair} onSelect={onSelect} />
        <MarketInfoPanel
          selectedPair={selectedPair}
          onPoolModeChange={onMarketTypeChange}
        />
      </div>

      {/* Favourite Pairs */}
      <FavouritePair onSelect={onSelect} />
    </div>
  );
}
