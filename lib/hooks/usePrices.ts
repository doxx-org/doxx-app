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
      };

      return prices;
    },
  });
};
