import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clientEnvConfig } from "../envConfig";
import addressesDevnet from "./address.devnet.json";
import addressesMainnet from "./address.mainnet.json";
import addressesTestnet from "./address.testnet.json";

interface _Pool {
  poolState: string;
  ammConfig: string;
  mintA: string;
  mintB: string;
  authority: string;
  lpMint: string;
  vaultA: string;
  vaultB: string;
  feeVault: string;
  observation: string;
}

interface Pool {
  owner: string;
  programId: string;
}

interface AllPools {
  usdcSsol: Pool;
}

export interface AddressConfig {
  contracts: {
    pools: AllPools;
  };
  tokens: {
    solayer: string;
    solayerUSD: string;
    usdc: string;
    ssol: string;
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
