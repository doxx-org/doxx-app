import { Raydium } from "@doxxorg/cpmm-sdk";
import { useQuery } from "@tanstack/react-query";

export function useGetCPMMPoolInfo(
  raydium: Raydium | undefined,
  poolId: string,
) {
  return useQuery({
    queryKey: ["cpmmPoolInfo", poolId],
    queryFn: async () => {
      if (!raydium || poolId === "") return undefined;
      const poolInfo = await raydium.cpmm.getPoolInfoFromRpc(poolId);
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
