import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clientEnvConfig } from "../envConfig";
import addressesDevnet from "./address.devnet.json";
import addressesMainnet from "./address.mainnet.json";
import addressesTestnet from "./address.testnet.json";

export interface AddressConfig {
  contracts: {
    createPoolFee: string;
  };
  tokens: {
    solana: string;
    solayer: string;
    solayerUSD: string;
    usdc: string;
    ssol: string;
    token1: string;
    token2: string;
  };
}

export const getAddresses = (): AddressConfig => {
  switch (clientEnvConfig.NEXT_PUBLIC_NETWORK) {
    case WalletAdapterNetwork.Devnet:
      return addressesDevnet;
    case WalletAdapterNetwork.Testnet:
      return addressesTestnet;
    default:
      // default to mainnet
      return addressesMainnet;
  }
};

export const addressConfig = getAddresses();

export const getTokenAddress = (
  token: keyof AddressConfig["tokens"],
): string => {
  return addressConfig.tokens[token];
};
