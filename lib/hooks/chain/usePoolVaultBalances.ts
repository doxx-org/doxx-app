import { Connection, PublicKey } from "@solana/web3.js";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getAccount } from "@solana/spl-token";

interface VaultBalances {
  token0Balance: bigint;
  token1Balance: bigint;
}

/**
 * Fetch vault balances for a pool to calculate proper LP token amounts
 */
export function usePoolVaultBalances(
  connection: Connection | undefined,
  token0Vault: PublicKey | undefined,
  token1Vault: PublicKey | undefined,
): UseQueryResult<VaultBalances | undefined, Error> {
  return useQuery({
    queryKey: ["poolVaultBalances", token0Vault?.toBase58(), token1Vault?.toBase58()],
    queryFn: async (): Promise<VaultBalances | undefined> => {
      if (!connection || !token0Vault || !token1Vault) return undefined;

      try {
        const [vault0Account, vault1Account] = await Promise.all([
          getAccount(connection, token0Vault),
          getAccount(connection, token1Vault),
        ]);

        return {
          token0Balance: vault0Account.amount,
          token1Balance: vault1Account.amount,
        };
      } catch (error) {
        console.error("Error fetching vault balances:", error);
        throw error;
      }
    },
    enabled: !!connection && !!token0Vault && !!token1Vault,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

