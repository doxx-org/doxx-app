import {
  solayer,
  solayerUSD,
  ssol,
  token1,
  token2,
  usdc,
} from "./tokenProfile";
import { TokenProfile } from "./type";

export * from "./tokenProfile";
export * from "./type";

export const knownTokenProfiles: TokenProfile[] = [
  usdc,
  solayer,
  solayerUSD,
  ssol,
  token1,
  token2,
];

export const defaultSwapTokens: TokenProfile[] = [token1, token2];

export const knownTokenProfilesMap: Record<string, TokenProfile> =
  knownTokenProfiles.reduce(
    (acc, p) => {
      acc[p.address] = p;
      return acc;
    },
    {} as Record<string, TokenProfile>,
  );
