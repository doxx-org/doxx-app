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
  // TODO: add decimal
  image: string;
}
