"use client";

import { useState } from "react";
import { ActivityPanel, ProTradePanel, TradingGraph } from "./pro";
import { TradingPairHeader } from "./pro/trading-pair-header";
import { MarketType, TradingPair } from "./pro/trading-pair-header/types";

export const mockMarketPairs: TradingPair[] = [
  {
    symbol: "ETH-USDC",
    address: "EAqRCe9xcQvfAfqCCzVhbu839ysxLawL8NPkngRweE6i",
    lastPrice: 3466.66,
    marketCap: 4219090124.21,
    volume24h: 123123123.12,
    change24h: -1.71,
    change24hValue: -60.26,
    selectedMarketType: MarketType.AMM,
    allMarketType: [MarketType.AMM],
  },
  {
    symbol: "BTC-USDC",
    address: "HLaxJ13C7m6fKwrfnnzpmWXjdAH3ZL9sGR6mxZMA4tdk",
    lastPrice: 93245.23,
    marketCap: 123123123.12,
    volume24h: 1231231.12,
    change24h: 1.77,
    change24hValue: 107141.1,
    selectedMarketType: MarketType.CLOB,
    allMarketType: [MarketType.CLOB],
  },
  {
    symbol: "SOL-USDC",
    address: "DyyHbfkCSWcHjaB8GTVCqkVFC3NpxgF9wXsEgvNLSSn1",
    lastPrice: 145.55,
    marketCap: 52123123.12,
    volume24h: 3942831.12,
    change24h: 1.06,
    change24hValue: 145.55,
    selectedMarketType: MarketType.AMM,
    allMarketType: [MarketType.AMM, MarketType.CLOB],
  },
];

export function ProSwapWidget() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(
    mockMarketPairs[0],
  );
  const [tradingType, setTradingType] = useState<MarketType>(MarketType.AMM);

  const handleMarketTypeChange = (value: MarketType) => {
    setSelectedPair({
      ...selectedPair,
      selectedMarketType: value,
    });
    setTradingType(value);
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Market Info Bar */}
      <TradingPairHeader
        selectedPair={selectedPair}
        onSelect={setSelectedPair}
        onMarketTypeChange={handleMarketTypeChange}
      />

      {/* Main Content Area */}
      <div className="flex w-full">
        {/* Left: */}
        <div className="flex w-full flex-col">
          {/* Trading Graph */}
          <div className="min-h-[496px]">
            <TradingGraph />
          </div>
          {/* Activity Panel */}
          <div className="h-full">
            <ActivityPanel />
          </div>
        </div>
        {/* Right: Trade Panel */}
        <div className="min-w-[400px]">
          <ProTradePanel selectedPair={selectedPair} />
        </div>
      </div>
    </div>
  );
}
