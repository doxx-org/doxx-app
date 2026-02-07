import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { CHAIN, clientEnvConfig } from "../config/envConfig";

export function getTxExplorerUrl(address: string): string {
  switch (clientEnvConfig.NEXT_PUBLIC_CHAIN) {
    case CHAIN.SOLANA:
      return getSolanaTxExplorerUrl(address);
    default:
      // case CHAIN.SOLAYER:
      return getSolayerTxExplorerUrl(address);
  }
}

export function getAddressExplorerUrl(address: string): string {
  switch (clientEnvConfig.NEXT_PUBLIC_CHAIN) {
    case CHAIN.SOLANA:
      return getSolanaAccountExplorerUrl(address);
    default:
      // case CHAIN.SOLAYER:
      return getSolayerAddressExplorerUrl(address);
  }
}

export function getTokenExplorerUrl(address: string): string {
  switch (clientEnvConfig.NEXT_PUBLIC_CHAIN) {
    case CHAIN.SOLANA:
      return getSolanaTokenExplorerUrl(address);
    default:
      // case CHAIN.SOLAYER:
      return getSolayerAddressExplorerUrl(address);
  }
}

// ======================== SOLANA ========================
function getSolanaAccountExplorerUrl(address: string): string {
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

function getSolanaTokenExplorerUrl(address: string): string {
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

function getSolanaTxExplorerUrl(address: string): string {
  const explorerUrl = `https://solscan.io/tx/${address}`;
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

function getSolayerTxExplorerUrl(address: string): string {
  const explorerUrl = `https://explorer.solayer.org/tx/${address}`;
  switch (clientEnvConfig.NEXT_PUBLIC_NETWORK) {
    case WalletAdapterNetwork.Testnet:
    case WalletAdapterNetwork.Devnet:
      return `${explorerUrl}?cluster=devnet`;
    default:
      return `${explorerUrl}`;
  }
}