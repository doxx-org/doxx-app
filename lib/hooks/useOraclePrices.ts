import { UseQueryResult, useQuery } from "@tanstack/react-query";
import axios from "axios";
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
      const priceMap: PriceMap = mockPrices;

      try {
        // TODO: Get all prices from API
        const prices = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        );
        priceMap[solana.address] = prices.data.solana.usd;
      } catch {
        console.error("Error fetching prices, use mock prices instead");
      }

      return priceMap;
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
};
