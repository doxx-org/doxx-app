import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useQuery } from "@tanstack/react-query";

export function useGetPoolInfo(raydium: Raydium | undefined, poolId: string) {
  return useQuery({
    queryKey: ["poolInfo", poolId],
    queryFn: async () => {
      if (!raydium || poolId === "") return undefined;
      const poolInfo = await raydium.clmm.getPoolInfoFromRpc(poolId);
      return poolInfo;
    },
    enabled: !!raydium && !!poolId,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 1, // 1 minute
    refetchInterval: 1000 * 60 * 1, // 1 minute
    refetchIntervalInBackground: true,
    // refetchOnMount: true,
    // refetchOnWindowFocus: true,
    // refetchOnReconnect: true,
  });
}
