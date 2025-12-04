"use client";

import { useState } from "react";
import { ActivityPanel, FooterStats, ProTradePanel, TradingGraph } from "./pro";
import { TradingPairHeader } from "./pro/trading-pair-header";
import { MarketType, TradingPair } from "./pro/trading-pair-header/types";

const mockTradingPair: TradingPair = {
  symbol: "ETH-USDC",
  selectedMarketType: MarketType.AMM,
  allMarketType: [MarketType.AMM],
  lastPrice: 3466.66,
  address: "EAqRCe9xcQvfAfqCCzVhbu839ysxLawL8NPkngRweE6i",
  change24h: -1.71,
  change24hValue: -60.26,
  marketCap: "$3,465.52",
  volume24h: "",
  contract: "",
};

export function ProSwapWidget() {
  const [selectedPair, setSelectedPair] =
    useState<TradingPair>(mockTradingPair);
  const [tradingType, setTradingType] = useState<MarketType>(MarketType.AMM);

  const handleMarketTypeChange = (value: MarketType) => {
    setSelectedPair({
      ...selectedPair,
      selectedMarketType: value,
    });
    setTradingType(value);
  };

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Market Info Bar */}
      <TradingPairHeader
        selectedPair={selectedPair}
        onSelect={setSelectedPair}
        onMarketTypeChange={handleMarketTypeChange}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: Trading Graph */}
        <div className="min-h-[500px]">
          <TradingGraph />
        </div>

        {/* Right: Trade Panel */}
        <div className="w-full">
          <ProTradePanel />
        </div>
      </div>

      {/* Activity Panel */}
      <div className="min-h-[400px]">
        <ActivityPanel />
      </div>

      {/* Footer Stats */}
      <FooterStats />
    </div>
  );
}
