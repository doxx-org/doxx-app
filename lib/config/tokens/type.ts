export enum TokenSymbol {
  LAYER = "LAYER",
  sUSD = "sUSD",
  USDC = "USDC",
  sSOL = "sSOL",
}

export interface TokenProfile {
  name: string;
  symbol: TokenSymbol;
  address: string;
  decimal: number;
  image: string;
}
