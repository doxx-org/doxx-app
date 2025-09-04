"use client";

import React, { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  BitgetWalletAdapter,
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

interface WalletConnectionProviderProps {
  children: ReactNode;
}

// The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
// TODO: use value from .env?
const network = WalletAdapterNetwork.Devnet;

// NOTE: add or remove wallets as needed
const wallets = [
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
];

export const WalletConnectionProvider: FC<WalletConnectionProviderProps> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // only render children on client

  // NOTE: provide a custom RPC endpoint if needed
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  if (!mounted) return null;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
