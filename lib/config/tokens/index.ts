import { solayer } from "./tokenProfile";
import { solayerUSD } from "./tokenProfile";
import { usdc } from "./tokenProfile";
import { ssol } from "./tokenProfile";
import { TokenProfile } from "./type";

export * from "./tokenProfile";
export * from "./type";

export const knownTokenProfiles: TokenProfile[] = [
  usdc,
  solayer,
  solayerUSD,
  ssol,
];

export const defaultSwapTokens: TokenProfile[] = [solayer, usdc];

export const knownTokenProfilesMap: Record<string, TokenProfile> =
  knownTokenProfiles.reduce(
    (acc, p) => {
      acc[p.address] = p;
      return acc;
    },
    {} as Record<string, TokenProfile>,
  );
