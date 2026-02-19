import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { PriceSource } from "../config/tokens";
import { PriceMap } from "./chain/types";
import { useGetAllPools } from "./chain/useGetAllPools";
import { useOraclePrices } from "./useOraclePrices";

export const useAllPrices = (): UseQueryResult<PriceMap, Error> => {
  const { data: oraclePrices } = useOraclePrices();
  const { data: allPools } = useGetAllPools();

  return useQuery({
    queryKey: ["allPrices", allPools?.length, oraclePrices],
    queryFn: async () => {
      const prices: PriceMap = {};

      // Unique pool tokens (by address), preserving token profile with priceSource
      const allPoolTokens = Array.from(
        new Map(
          (
            allPools?.flatMap((p) => [p.lpToken.token1, p.lpToken.token2]) ?? []
          ).map((t) => [t.address, t]),
        ).values(),
      );

      // 1. For each token that appears in a pool: respect its priceSource
      for (const poolToken of allPoolTokens) {
        const addr = poolToken.address;
        if (poolToken.priceSource === PriceSource.ORACLE) {
          const oraclePrice = oraclePrices?.[addr];
          if (typeof oraclePrice === "number") {
            prices[addr] = oraclePrice;
          }
        } else {
          // PriceSource.POOL (or fallback): use pool-derived price
          const pool = allPools?.find(
            (p) =>
              p.lpToken.token1.address === addr ||
              p.lpToken.token2.address === addr,
          );
          if (pool) {
            const usdPrice =
              pool.lpToken.token1.address === addr
                ? pool.priceToken1Usd
                : pool.priceToken2Usd;
            if (typeof usdPrice === "number") {
              prices[addr] = usdPrice;
            }
          }
        }
      }

      // 2. Include oracle-only tokens (in oracle but not in any pool)
      if (oraclePrices) {
        const poolAddresses = new Set(allPoolTokens.map((t) => t.address));
        for (const [addr, value] of Object.entries(oraclePrices)) {
          if (typeof value === "number" && !poolAddresses.has(addr)) {
            prices[addr] = value;
          }
        }
      }

      return prices;
    },
    enabled: !!allPools,
  });
};
