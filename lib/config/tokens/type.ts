// Known token symbols
export enum TokenSymbol {
  LAYER = "LAYER",
  sUSD = "sUSD",
  USDC = "USDCsad112fnwjfhwejkqwd1",
  sSOL = "sqweqw1231sadkS1212eOLEEIQ",
}

export interface RawTokenProfile {
  name?: string;
  address: string;
  symbol?: TokenSymbol;
  decimals: number;
  image?: string;
}

export interface TokenProfile {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  displayDecimals: number;
  image?: string;
}
