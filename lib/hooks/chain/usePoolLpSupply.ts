import { Connection, PublicKey } from "@solana/web3.js";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getMint } from "@solana/spl-token";

/**
 * Fetch the total supply of LP tokens for a pool
 */
export function usePoolLpSupply(
  connection: Connection | undefined,
  lpMint: PublicKey | undefined,
): UseQueryResult<bigint | undefined, Error> {
  return useQuery({
    queryKey: ["poolLpSupply", lpMint?.toBase58()],
    queryFn: async (): Promise<bigint | undefined> => {
      if (!connection || !lpMint) return undefined;

      try {
        const mintInfo = await getMint(connection, lpMint);
        return mintInfo.supply;
      } catch (error) {
        console.error("Error fetching LP supply:", error);
        throw error;
      }
    },
    enabled: !!connection && !!lpMint,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

