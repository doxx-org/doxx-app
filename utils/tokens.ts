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
  image: string;
}

// TODO: Replace with real config
export const tokenProfiles: TokenProfile[] = [
  {
    name: "SOLAYER",
    symbol: TokenSymbol.LAYER,
    address: "0x0000000000000000000000000000000000000000",
    image: "/coins/layer.svg",
  },
  {
    name: "Solayer USD",
    symbol: TokenSymbol.sUSD,
    address: "0x0000000000000000000000000000000000000000",
    image: "/coins/susd.svg",
  },
  {
    name: "USDC",
    symbol: TokenSymbol.USDC,
    address: "0x0000000000000000000000000000000000000000",
    image:
      "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
  },
  {
    name: "Solayer Staked SOL",
    symbol: TokenSymbol.sSOL,
    address: "0x0000000000000000000000000000000000000000",
    image: "/coins/ssol.svg",
  },
];

export function ellipseAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4,
): string {
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}
