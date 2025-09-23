import { useMemo } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";

interface UseProviderProps {
  connection: Connection;
  wallet: AnchorWallet | undefined;
}

export function useProvider({ connection, wallet }: UseProviderProps) {
  const provider = useMemo(() => {
    if (!wallet) return undefined;

    return new AnchorProvider(connection, wallet, {
      commitment: "processed",
      preflightCommitment: "processed",
    });
  }, [connection, wallet]);

  return provider;
}
