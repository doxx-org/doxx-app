export enum TokenSymbol {
  LAYER = "LAYER",
  sUSD = "sUSD",
  USDC = "USDC",
  sSOL = "sSOL",
}

export interface TokenProfile {
  name?: string;
  address: string;
  symbol?: TokenSymbol;
  decimals: number;
  image?: string;
}
