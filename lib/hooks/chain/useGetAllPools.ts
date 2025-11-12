import { Program } from "@coral-xyz/anchor";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import { PoolStateWithConfig } from "./types";

/** Read a PoolState by explicit public key, and keep it in state */
export function useGetAllPools(
  program: Program<DoxxAmm> | undefined,
): UseQueryResult<PoolStateWithConfig[] | undefined, Error> {
  return useQuery({
    queryKey: ["allPoolStates"],
    queryFn: async (): Promise<PoolStateWithConfig[] | undefined> => {
      if (!program) return undefined;

      // get all pool states
      const allPoolStates = await program.account.poolState.all();

      // get all amm configs and observation states
      const allConfigs = await Promise.all(
        allPoolStates.map(async (poolState) => {
          const ammConfig = await program.account.ammConfig.fetch(
            poolState.account.ammConfig,
          );
          const observationState = await program.account.observationState.fetch(
            poolState.account.observationKey,
          );
          return { ammConfig, observationState };
        }),
      );

      // combine pool states, amm configs and observation states
      const allPoolStatesData: PoolStateWithConfig[] = allPoolStates.map(
        (poolState, index) => {
          const { ammConfig, observationState } = allConfigs[index];

          return {
            poolState: { ...poolState.account },
            ammConfig,
            observationState,
          };
        },
      );

      return allPoolStatesData;
    },
    refetchOnWindowFocus: false,
    enabled: !!program,
    refetchInterval: 15 * 1000, // 15 seconds
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 60 seconds
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}
