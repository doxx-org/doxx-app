import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { solayer, solayerUSD, ssol, usdc } from "../config/tokens";
import { PriceMap } from "./chain/types";

export const usePrices = (): UseQueryResult<PriceMap, Error> => {
  return useQuery({
    queryKey: ["allPrices"],
    queryFn: async () => {
      // TODO: Get prices from API
      const prices: PriceMap = {
        [usdc.address]: 1.0,
        [solayer.address]: 0.1771,
        [solayerUSD.address]: 0.91,
        [ssol.address]: 138.38,
        // UNK
        ["2egW39Canf2oPP7jenwjkW8y8CwsDcEiDC8xnaYeo6sw"]: 1230.2,
        // TOKEN2
        ["5mvoZPmbP7j4RQKmEwF6B94aTKoihEKo1LpVeimzexDh"]: 0.00214,
      };

      return prices;
    },
  });
};
