import { PublicKey } from "@solana/web3.js";
import { RawTokenProfile, knownTokenProfiles } from "../config/tokens";
import { PoolStateWithConfig } from "../hooks/chain/types";

export function ellipseAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4,
): string {
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

export function mapPoolTokenToProfiles(
  poolStates: PoolStateWithConfig[],
  rawTokenProfiles: RawTokenProfile[] | undefined,
): RawTokenProfile[] {
  // get all token profiles from pool states
  const allTokenProfiles = poolStates.flatMap((p) => {
    const poolState = p.poolState;

    const token0Profile: RawTokenProfile = {
      address: poolState.token0Mint.toString(),
      decimals: poolState.mint0Decimals,
    };

    const token1Profile: RawTokenProfile = {
      address: poolState.token1Mint.toString(),
      decimals: poolState.mint1Decimals,
    };

    return [token0Profile, token1Profile];
  });

  // merge with known token profiles
  const mergedTokenProfiles = [
    ...knownTokenProfiles.map((p) => ({
      address: p.address,
      decimals: p.decimals,
    })),
    ...allTokenProfiles,
    ...(rawTokenProfiles ?? []),
  ];

  // filter out invalid token profiles
  const validTokenProfiles: RawTokenProfile[] = mergedTokenProfiles.filter(
    (p) => {
      try {
        new PublicKey(p.address);
        return true;
      } catch {
        return false;
      }
    },
  );

  // remove duplicates
  const uniqueTokenProfiles = validTokenProfiles.filter(
    (p, index, self) =>
      index ===
      self.findIndex(
        (t) => t.address.toLowerCase() === p.address.toLowerCase(),
      ),
  );

  return uniqueTokenProfiles;
}
