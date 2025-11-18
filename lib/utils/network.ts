import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clientEnvConfig } from "../config/envConfig";

export function getAccountExplorerUrl(address: string): string {
  const explorerUrl = `https://solscan.io/account/${address}`;
  switch (clientEnvConfig.NEXT_PUBLIC_NETWORK) {
    case WalletAdapterNetwork.Testnet:
      return `${explorerUrl}?cluster=testnet`;
    case WalletAdapterNetwork.Devnet:
      return `${explorerUrl}?cluster=devnet`;
    default:
      return `${explorerUrl}`;
  }
}

export function getTokenExplorerUrl(address: string): string {
  const explorerUrl = `https://solscan.io/token/${address}`;
  switch (clientEnvConfig.NEXT_PUBLIC_NETWORK) {
    case WalletAdapterNetwork.Testnet:
      return `${explorerUrl}?cluster=testnet`;
    case WalletAdapterNetwork.Devnet:
      return `${explorerUrl}?cluster=devnet`;
    default:
      return `${explorerUrl}`;
  }
}
