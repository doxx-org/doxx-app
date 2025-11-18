// app/hooks/useTokenDisplays.ts
import { useMemo } from "react";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import type { GetAllTokenInfosPayload } from "@/app/api/token-infos/type";
import { RawTokenProfile, TokenProfile } from "@/lib/config/tokens";
import { simplifyGetAllTokenInfosErrorMsg } from "@/lib/utils/errors/get-all-token-error";
import { mapPoolTokenToProfiles } from "@/lib/utils/tokens";
import { PoolStateWithConfig } from "./types";

export function useGetAllTokenInfos(
  poolStates: PoolStateWithConfig[] | undefined,
  rawTokenProfiles?: RawTokenProfile[],
): UseQueryResult<TokenProfile[] | undefined, Error> {
  const allTokenProfiles: RawTokenProfile[] | undefined = useMemo(() => {
    if (!poolStates) return undefined;

    return mapPoolTokenToProfiles(poolStates, rawTokenProfiles);
  }, [poolStates, rawTokenProfiles]);

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
          displayDecimals: d.displayDecimals,
          image: d.image,
        }));

        return displays;
      } catch (error) {
        throw new Error(simplifyGetAllTokenInfosErrorMsg(error));
      }
    },
    enabled: !!allTokenProfiles && allTokenProfiles.length > 0,
    staleTime: 120_000, // align with s-maxage
    gcTime: 15 * 60 * 1000,
  });
}
