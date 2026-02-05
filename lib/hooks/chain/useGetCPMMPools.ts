import { Program } from "@coral-xyz/anchor";
import { keepPreviousData, UseQueryResult, useQuery } from "@tanstack/react-query";
import { DoxxCpmmIdl } from "@/lib/idl";
import { CPMMPoolStateWithConfig } from "./types";

/** Read a PoolState by explicit public key, and keep it in state */
export function useGetCPMMPools(
  program: Program<DoxxCpmmIdl> | undefined,
  opts?: {
    /** Disable by default to avoid stacked polling across consumers. */
    refetchIntervalMs?: number | false;
    /** How long data is considered fresh. */
    staleTimeMs?: number;
  },
): UseQueryResult<CPMMPoolStateWithConfig[] | undefined, Error> {
  return useQuery({
    queryKey: ["allCpmmPoolStates"],
    queryFn: async (): Promise<CPMMPoolStateWithConfig[] | undefined> => {
      if (!program) return undefined;

      // get all pool states
      const allPoolStates = await program.account.poolState.all();

      // collect all addresses for batch fetching
      const uniqueAmmConfigAddresses = Array.from(
        new Map(
          allPoolStates.map((poolState) => [
            poolState.account.ammConfig.toBase58(),
            poolState.account.ammConfig,
          ]),
        ).values(),
      );

      const uniqueObservationStateAddresses = Array.from(
        new Map(
          allPoolStates.map((poolState) => [
            poolState.account.observationKey.toBase58(),
            poolState.account.observationKey,
          ]),
        ).values(),
      );

      // batch fetch all amm configs and observation states
      const [ammConfigs, observationStates] = await Promise.all([
        program.account.ammConfig.fetchMultiple(uniqueAmmConfigAddresses),
        program.account.observationState.fetchMultiple(
          uniqueObservationStateAddresses,
        ),
      ]);

      const ammConfigByAddress = new Map(
        uniqueAmmConfigAddresses.map((addr, index) => [
          addr.toBase58(),
          ammConfigs[index],
        ]),
      );
      const observationStateByAddress = new Map(
        uniqueObservationStateAddresses.map((addr, index) => [
          addr.toBase58(),
          observationStates[index],
        ]),
      );

      // combine pool states, amm configs and observation states
      const allPoolStatesData: CPMMPoolStateWithConfig[] = allPoolStates.map(
        (poolState) => {
          const ammConfig = ammConfigByAddress.get(
            poolState.account.ammConfig.toBase58(),
          );
          const observationState = observationStateByAddress.get(
            poolState.account.observationKey.toBase58(),
          );

          if (!ammConfig || !observationState) {
            // TODO: handle this error
            throw new Error(
              `Failed to fetch configs for pool ${poolState.publicKey.toBase58()}`,
            );
          }

          return {
            poolId: observationState.poolId,
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
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchIntervalMs ?? false,
    staleTime: opts?.staleTimeMs ?? 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });
}
