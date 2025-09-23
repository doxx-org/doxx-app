import { APP_NETWORK, clientEnvConfig } from "../envConfig";
import addresses from "./address.devnet.json";

export interface AddressConfig {
  contracts: {
    pool: string;
  };
  tokens: {
    solayer: string;
    solayerUSD: string;
    usdc: string;
    ssol: string;
  };
}

export const getAddresses = (): AddressConfig => {
  if (clientEnvConfig.NEXT_PUBLIC_NETWORK === APP_NETWORK.DEVNET) {
    return addresses;
  }

  return addresses;
};

export const addressConfig = getAddresses();

export const getContractAddress = (
  category: keyof AddressConfig["contracts"],
): string => {
  return addressConfig.contracts[category];
};

export const getTokenAddress = (
  token: keyof AddressConfig["tokens"],
): string => {
  return addressConfig.tokens[token];
};
