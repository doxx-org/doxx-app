"use client";

import React, { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  BitgetWalletAdapter,
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { toast } from "sonner";
import { simplifyErrorMessage } from "@/utils/error";

interface WalletConnectionProviderProps {
  children: ReactNode;
}

// The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
// TODO: use value from .env?
const network = WalletAdapterNetwork.Devnet;

// NOTE: provide a custom RPC endpoint if needed
const endpoint = clusterApiUrl(network);

export const WalletConnectionProvider: FC<WalletConnectionProviderProps> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // only render children on client

  // Memoize wallets array to prevent recreation on every render
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new WalletConnectWalletAdapter({
        network,
        options: {
          // TODO: replace with actual project id
          projectId: "1234567890",
        },
      }),
      new SolflareWalletAdapter(),
      new BitgetWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    [],
  );

  if (!mounted) return null;

  const handleError = (error: Error) => {
    toast.error(simplifyErrorMessage(error));
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={handleError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};
