import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { solana, solayer, solayerUSD, ssol, usdc } from "../config/tokens";
import { SOLANA_PRICE } from "../constants";
import { PriceMap } from "./chain/types";

const mockPrices: PriceMap = {
  [usdc.address]: 1.0,
  [solayer.address]: 0.1771,
  [solayerUSD.address]: 0.91,
  [ssol.address]: 138.38,
  // UNK
  ["2egW39Canf2oPP7jenwjkW8y8CwsDcEiDC8xnaYeo6sw"]: 1230.2,
  // TOKEN2
  ["5mvoZPmbP7j4RQKmEwF6B94aTKoihEKo1LpVeimzexDh"]: 0.00214,
  [solana.address]: SOLANA_PRICE,
};

export const useOraclePrices = (): UseQueryResult<PriceMap, Error> => {
  return useQuery({
    queryKey: ["oraclePrices"],
    queryFn: async () => {
      // TODO: Get prices from API

      return mockPrices;
    },
  });
};
