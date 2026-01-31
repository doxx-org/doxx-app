import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { CHAIN, clientEnvConfig } from "../config/envConfig";

export function getAddressExplorerUrl(address: string): string {
  console.log("🚀 ~ address:", address)
  switch (clientEnvConfig.NEXT_PUBLIC_CHAIN) {
    case CHAIN.SOLANA:
      return getSolanaAccountExplorerUrl(address);
    case CHAIN.SOLAYER:
      return getSolayerAddressExplorerUrl(address);
  }
}

export function getTokenExplorerUrl(address: string): string {
  switch (clientEnvConfig.NEXT_PUBLIC_CHAIN) {
    case CHAIN.SOLANA:
      return getSolanaTokenExplorerUrl(address);
    case CHAIN.SOLAYER:
      return getSolayerAddressExplorerUrl(address);
  }
}

// ======================== SOLANA ========================
export function getSolanaAccountExplorerUrl(address: string): string {
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

export function getSolanaTokenExplorerUrl(address: string): string {
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

// ======================== SOLAYER ========================
function getSolayerAddressExplorerUrl(address: string): string {
  const explorerUrl = `https://explorer.solayer.org/address/${address}`;
  switch (clientEnvConfig.NEXT_PUBLIC_NETWORK) {
    case WalletAdapterNetwork.Testnet:
    case WalletAdapterNetwork.Devnet:
      return `${explorerUrl}?cluster=devnet`;
    default:
      return `${explorerUrl}`;
  }
}