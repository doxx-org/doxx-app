import { addressConfig } from "../addresses";
import { TokenProfile, TokenSymbol } from "./type";

export const solayer: TokenProfile = {
  name: "SOLAYER",
  symbol: TokenSymbol.LAYER,
  address: addressConfig.tokens.solayer,
  decimal: 9,
  image: "/coins/layer.svg",
};

export const solayerUSD: TokenProfile = {
  name: "Solayer USD",
  symbol: TokenSymbol.sUSD,
  address: addressConfig.tokens.solayerUSD,
  decimal: 6,
  image: "/coins/susd.svg",
};

export const usdc: TokenProfile = {
  name: "USDC",
  symbol: TokenSymbol.USDC,
  address: addressConfig.tokens.usdc,
  decimal: 6,
  image:
    "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
};

export const ssol: TokenProfile = {
  name: "Solayer Staked SOL",
  symbol: TokenSymbol.sSOL,
  address: addressConfig.tokens.ssol,
  decimal: 9,
  image: "/coins/ssol.svg",
};
