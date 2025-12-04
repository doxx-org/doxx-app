export interface TradingPair {
  address: string;
  symbol: string;
  iconUrl?: string;
  lastPrice: number;
  change24h: number;
  change24hValue: number;
  selectedMarketType: MarketType;
  allMarketType: MarketType[];
  marketCap?: number;
  volume24h?: number;
}

export enum MarketType {
  AMM = "AMM",
  CLOB = "CLOB",
  PERP = "PERP",
}
