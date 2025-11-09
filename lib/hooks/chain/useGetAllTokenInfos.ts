// app/hooks/useTokenDisplays.ts
import { useMemo } from "react";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import type {
  GetAllTokenInfosPayload,
  TokenDisplay,
} from "@/app/api/token-infos/type";
import { TokenProfile, TokenSymbol } from "@/lib/config/tokens";
import { mapPoolTokenToProfiles } from "@/lib/utils/tokens";
import { PoolStateWithConfig } from "./types";

export function useGetAllTokenInfos(
  poolStates: PoolStateWithConfig[] | undefined,
  knownTokenProfiles: TokenProfile[] | undefined,
): UseQueryResult<TokenProfile[] | undefined, Error> {
  const allTokenProfiles: TokenProfile[] | undefined = useMemo(() => {
    if (!poolStates || !knownTokenProfiles) return undefined;

    return mapPoolTokenToProfiles(poolStates, knownTokenProfiles);
  }, [poolStates, knownTokenProfiles]);

  return useQuery({
    queryKey: [
      "token-displays",
      allTokenProfiles
        ?.map((p) => p.address)
        .sort()
        .join(","),
    ], // stable key
    queryFn: async () => {
      try {
        if (!allTokenProfiles || allTokenProfiles.length === 0)
          return undefined;

        const params: GetAllTokenInfosPayload[] = allTokenProfiles.map((p) => {
          return { address: p.address, decimals: p.decimals };
        });

        const res = await fetch("/api/token-infos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ params }),
        });

        if (!res.ok) throw new Error("Failed to fetch");
        const json = (await res.json()) as { data: TokenProfile[] };

        const displays = json.data.map((d) => ({
          address: d.address,
          name: d.name,
          symbol: d.symbol,
          decimals: d.decimals,
          image: d.image,
        }));

        return displays;
      } catch (_) {
        throw new Error("Failed to fetch");
      }
    },
    enabled: !!allTokenProfiles && allTokenProfiles.length > 0,
    staleTime: 120_000, // align with s-maxage
    gcTime: 15 * 60 * 1000,
  });
}
