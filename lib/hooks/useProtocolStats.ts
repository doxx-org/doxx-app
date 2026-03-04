import { useMemo } from "react";
import { BPS } from "@/lib/constants";
import { useGetAllPools } from "./chain/useGetAllPools";

export type ProtocolStats = {
  tvl: number;
  volume24h: number;
  fees24h: number;
  isLoading: boolean;
};

export function useProtocolStats(): ProtocolStats {
  const { data: pools, isLoading } = useGetAllPools();

  const stats = useMemo(() => {
    if (!pools) return { tvl: 0, volume24h: 0, fees24h: 0 };

    let tvl = 0;
    let volume24h = 0;
    let fees24h = 0;

    for (const pool of pools) {
      tvl += pool.tvl;
      volume24h += pool.dailyVol;
      const feeRate = pool.fee.toNumber() / BPS;
      fees24h += pool.dailyVol * feeRate;
    }

    return { tvl, volume24h, fees24h };
  }, [pools]);

  return { ...stats, isLoading };
}
