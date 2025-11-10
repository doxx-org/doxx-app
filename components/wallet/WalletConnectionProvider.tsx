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
import { toast } from "sonner";
import { clientEnvConfig } from "@/lib/config/envConfig";
import { simplifyErrorMessage } from "@/lib/utils";

interface WalletConnectionProviderProps {
  children: ReactNode;
}

const network = clientEnvConfig.NEXT_PUBLIC_NETWORK;
const endpoint = clientEnvConfig.NEXT_PUBLIC_RPC_URL;

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
        network: network as
          | WalletAdapterNetwork.Mainnet
          | WalletAdapterNetwork.Devnet,
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
