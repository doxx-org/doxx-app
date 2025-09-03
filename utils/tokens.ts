export enum TokenSymbol {
  LAYER = "LAYER",
  sUSD = "sUSD",
  USDC = "USDC",
  sSOL = "sSOL",
}

export interface TokenProfile {
  symbol: TokenSymbol;
  image: string;
}

export const tokenProfiles: TokenProfile[] = [
  {
    symbol: TokenSymbol.LAYER,
    image: "/coins/layer.svg",
  },
  {
    symbol: TokenSymbol.sUSD,
    image: "/coins/susd.svg",
  },
  {
    symbol: TokenSymbol.USDC,
    image:
      "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
  },
  {
    symbol: TokenSymbol.sSOL,
    image: "/coins/ssol.svg",
  },
];
