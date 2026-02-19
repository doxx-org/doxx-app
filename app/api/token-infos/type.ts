import { PriceSource } from "@/lib/config/tokens";

export type TokenDisplay = {
  mint: string;
  name?: string;
  symbol?: string;
  image?: string;
  decimals: number;
  priceSource?: PriceSource;
  // source: "list" | "metaplex" | "token2022" | "fallback";
};

export type GetAllTokenInfosPayload = {
  address: string;
  decimals: number;
};

export type MetaplexTokenMetadata = {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  decimals: number;
};

export type ResolveTokenFromUri = {
  name: string;
  symbol: string;
  address: string;
  uri: string;
  decimals: number;
};
