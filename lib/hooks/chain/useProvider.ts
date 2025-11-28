import { useMemo } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

interface UseProviderProps {
  connection: Connection;
  wallet: AnchorWallet | undefined;
}

/**
 * Creates a read-only wallet for data fetching when no wallet is connected.
 * This wallet cannot sign transactions but allows reading on-chain data.
 * Using a singleton dummy keypair to avoid creating new instances.
 */
const READ_ONLY_WALLET: AnchorWallet = (() => {
  // Use a dummy keypair for read-only operations
  // This wallet will never be used to sign transactions
  const dummyKeypair = Keypair.generate();

  return {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _transaction: T,
    ): Promise<T> => {
      // This should never be called for read-only operations
      throw new Error("Cannot sign transaction with read-only wallet");
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _transactions: T[],
    ): Promise<T[]> => {
      // This should never be called for read-only operations
      throw new Error("Cannot sign transactions with read-only wallet");
    },
  };
})();

export function useProvider({ connection, wallet }: UseProviderProps) {
  const provider = useMemo(() => {
    // If wallet is connected, use it; otherwise use a read-only provider
    const walletToUse = wallet ?? READ_ONLY_WALLET;

    return new AnchorProvider(connection, walletToUse, {
      commitment: "processed",
      preflightCommitment: "processed",
    });
  }, [connection, wallet]);

  return provider;
}
