import { addressConfig } from "../addresses";
import { TokenProfile, TokenSymbol } from "./type";

export const unknownToken: TokenProfile = {
  name: "UNKNOWN",
  symbol: "UNK",
  address: "",
  decimals: 9,
  displayDecimals: 4,
  image: undefined,
};

export const solayer: TokenProfile = {
  name: "SOLAYER",
  symbol: TokenSymbol.LAYER,
  address: addressConfig.tokens.solayer,
  decimals: 6,
  displayDecimals: 4,
  image: "/coins/layer.svg",
};

export const solayerUSD: TokenProfile = {
  name: "Solayer USD",
  symbol: TokenSymbol.sUSD,
  address: addressConfig.tokens.solayerUSD,
  decimals: 6,
  displayDecimals: 4,
  image: "/coins/susd.svg",
};

export const usdc: TokenProfile = {
  name: "USDC",
  symbol: TokenSymbol.USDC,
  address: addressConfig.tokens.usdc,
  decimals: 9,
  displayDecimals: 4,
  image:
    "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
};

export const ssol: TokenProfile = {
  name: "Solayer Staked SOL",
  symbol: TokenSymbol.sSOL,
  address: addressConfig.tokens.ssol,
  decimals: 9,
  displayDecimals: 4,
  image: "/coins/ssol.svg",
};

// For testing purposes
export const token1: TokenProfile = {
  name: "Token 1",
  symbol: "TOKEN1",
  address: addressConfig.tokens.token1,
  decimals: 9,
  displayDecimals: 4,
};

// For testing purposes
export const token2: TokenProfile = {
  name: "Token 2",
  symbol: "TOKEN2",
  address: addressConfig.tokens.token2,
  decimals: 9,
  displayDecimals: 4,
};
