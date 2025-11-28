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

      // collect all addresses for batch fetching
      const ammConfigAddresses = allPoolStates.map(
        (poolState) => poolState.account.ammConfig,
      );
      const observationStateAddresses = allPoolStates.map(
        (poolState) => poolState.account.observationKey,
      );

      // batch fetch all amm configs and observation states
      const [ammConfigs, observationStates] = await Promise.all([
        program.account.ammConfig.fetchMultiple(ammConfigAddresses),
        program.account.observationState.fetchMultiple(
          observationStateAddresses,
        ),
      ]);

      // combine pool states, amm configs and observation states
      const allPoolStatesData: PoolStateWithConfig[] = allPoolStates.map(
        (poolState, index) => {
          const ammConfig = ammConfigs[index];
          const observationState = observationStates[index];

          if (!ammConfig || !observationState) {
            // TODO: handle this error
            throw new Error(
              `Failed to fetch configs for pool at index ${index}`,
            );
          }

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
