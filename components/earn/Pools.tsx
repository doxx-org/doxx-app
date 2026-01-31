"use client";

import { useMemo, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  RawTokenProfile,
  knownTokenProfiles,
  unknownToken,
} from "@/lib/config/tokens";
import { useDoxxClmmProgram } from "@/lib/hooks/chain/useDoxxClmmProgram";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
import { useGetCLMMPools } from "@/lib/hooks/chain/useGetCLMMPools";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { DataTable } from "../ui/data-table";
import { SearchInput } from "../ui/search-input";
// import { CreatePoolDialog } from "./CreateCPMMPoolDialog";
import { createColumns } from "./PoolColumn";
import { DepositPoolDrawer } from "./v2/DepositPoolDrawer";
import { Pool, PoolType } from "./v2/types";

export function Pools() {
  const [searchValue, setSearchValue] = useState("");
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [isPoolDrawerOpen, setIsPoolDrawerOpen] = useState(false);

  // Hooks
  // const { connection } = useConnection();
  // const wallet = useAnchorWallet();
  // const provider = useProvider({ connection, wallet });
  // const doxxCpmmProgram = useDoxxCpmmProgram({ provider });
  // const doxxClmmProgram = useDoxxClmmProgram({ provider });

  // Fetch all pools
  // const {
  //   data: cpmmPoolsData,
  //   isLoading: isLoadingCpmmPools,
  //   // TODO: add refetchAllPoolStates to the dependencies
  //   // refetch: refetchAllPoolStates,
  // } = useGetCPMMPools(doxxCpmmProgram);

  // const {
  //   data: clmmPoolsData,
  //   isLoading: isLoadingClmmPools,
  //   // TODO: add refetchAllPoolStates to the dependencies
  //   // refetch: refetchAllPoolStates,
  // } = useGetCLMMPools(doxxClmmProgram);

  // Fetch token balances
  // const { data: splBalances } = useAllSplBalances(
  //   connection,
  //   wallet?.publicKey ?? undefined,
  //   knownTokenProfiles,
  //   true,
  // );

  // const poolTokens = useMemo(() => {
  //   return clmmPoolsData?.map((p) => {
  //     return {
  //       mint0Address: p.poolState.tokenMint0.toString(),
  //       mint0Decimals: p.poolState.mintDecimals0,
  //       mint1Address: p.poolState.tokenMint1.toString(),
  //       mint1Decimals: p.poolState.mintDecimals1,
  //     };
  //   });
  // }, [clmmPoolsData]);

  // const { data: allTokenProfiles, isLoading: isLoadingAllTokenProfiles } =
  //   useGetAllTokenInfos({ poolTokens });
  // useGetAllTokenInfos(cpmmPoolsData, rawTokenProfilesFromSplBalances);

  // // Transform pool data from chain to table format
  // const transformedPools = useMemo<Pool[]>(() => {
  //   // console.log("🚀 ~ cpmmPoolsData:", cpmmPoolsData);
  //   // console.log("🚀 ~ clmmPoolsData:", clmmPoolsData);
  //   if (!cpmmPoolsData || !allTokenProfiles || !clmmPoolsData) return []; // Fallback to mock data

  //   const cpmmPools: Pool[] = cpmmPoolsData.map((poolData) => {
  //     const { poolState, ammConfig } = poolData;
  //     // console.log(
  //     //   "🚀 ~ poolState.poolId:",
  //     //   poolData.observationState.poolId.toString(),
  //     // );
  //     // console.log("🚀 ~ poolState.lpmint:", poolState.lpMint.toString());

  //     // Find token profiles
  //     const token0Profile = allTokenProfiles.find(
  //       (t) => t.address === poolState.token0Mint.toBase58(),
  //     ) ?? {
  //       ...unknownToken,
  //       address: poolState.token0Mint.toBase58(),
  //     };
  //     const token1Profile = allTokenProfiles.find(
  //       (t) => t.address === poolState.token1Mint.toBase58(),
  //     ) ?? {
  //       ...unknownToken,
  //       address: poolState.token1Mint.toBase58(),
  //     };

  //     const poolAddress = poolData.observationState.poolId;

  //     // Calculate fee percentage from tradeFeeRate (basis points)
  //     // const feePercent = normalizeBPSString(ammConfig.tradeFeeRate.toString());

  //     return {
  //       poolId: poolAddress.toBase58(),
  //       fee: ammConfig.tradeFeeRate,
  //       lpToken: {
  //         token1: token0Profile,
  //         token2: token1Profile,
  //       },
  //       apr: 10, // Placeholder - calculate from fees/TVL
  //       tvl: 0, // Placeholder - fetch from vault balances
  //       dailyVol: 0, // Placeholder - fetch from analytics
  //       dailyVolperTvl: 0, // Placeholder
  //       reward24h: 0.001, // Placeholder - fetch from analytics
  //       cpmmPoolState: poolState, // IMPORTANT: Include the actual pool state for deposit
  //       // TODO: fetch from pool state
  //       price: 0.301,
  //       poolType: PoolType.CPMM, // Randomly assign pool type
  //     };
  //   });

  //   const clmmPools: Pool[] = clmmPoolsData.map((poolData) => {
  //     const { poolState, ammConfig } = poolData;
  //     // console.log(
  //     //   "🚀 ~ poolState.poolId:",
  //     //   poolData.observationState.poolId.toString(),
  //     // );
  //     // console.log("🚀 ~ poolState.lpmint:", poolState. lpMint.toString());

  //     // Find token profiles
  //     const token0Profile = allTokenProfiles.find(
  //       (t) => t.address === poolState.tokenMint0.toBase58(),
  //     ) ?? {
  //       ...unknownToken,
  //       address: poolState.tokenMint0.toBase58(),
  //     };
  //     const token1Profile = allTokenProfiles.find(
  //       (t) => t.address === poolState.tokenMint1.toBase58(),
  //     ) ?? {
  //       ...unknownToken,
  //       address: poolState.tokenMint1.toBase58(),
  //     };

  //     const poolAddress = poolData.observationState.poolId;

  //     return {
  //       poolId: poolAddress.toBase58(),
  //       fee: new BN(ammConfig.tradeFeeRate.toString()),
  //       lpToken: {
  //         token1: token0Profile,
  //         token2: token1Profile,
  //       },
  //       apr: 10, // Placeholder - calculate from fees/TVL
  //       tvl: 0, // Placeholder - fetch from vault balances
  //       dailyVol: 0, // Placeholder - fetch from analytics
  //       dailyVolperTvl: 0, // Placeholder
  //       reward24h: 0.001, // Placeholder - fetch from analytics
  //       clmmPoolState: poolState, // IMPORTANT: Include the actual pool state for deposit
  //       // TODO: fetch from pool state
  //       price: 0.301,
  //       poolType: PoolType.CLMM, // Randomly assign pool type
  //     };
  //   });

  //   return [...cpmmPools, ...clmmPools];
  // }, [cpmmPoolsData, clmmPoolsData, allTokenProfiles]);
  // console.log("🚀 ~ transformedPools:", transformedPools);

  const {
    data: allPools,
    isLoading: isLoadingAllPools,
    refetch: refetchAllPools,
  } = useGetAllPools();
  console.log("🚀 ~ isLoadingAllPools:", isLoadingAllPools);
  console.log("🚀 ~ allPools:", allPools);

  // const isLoading = useMemo(() => {
  //   return (
  //     isLoadingCpmmPools || isLoadingClmmPools || isLoadingAllTokenProfiles
  //   );
  // }, [isLoadingCpmmPools, , isLoadingClmmPools, isLoadingAllTokenProfiles]);

  const handleOpenDeposit = (pool: Pool) => {
    setSelectedPool(pool);
    setIsPoolDrawerOpen(true);
  };

  const poolColumns = createColumns(handleOpenDeposit);

  return (
    <div className="flex flex-col gap-4">
      <div className="h-full min-h-[660px] w-full">
        <DataTable
          columns={poolColumns}
          data={allPools ?? []}
          globalFilter={searchValue}
          pageSize={10}
          isLoading={isLoadingAllPools}
          searchInput={
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search pool or token"
            />
          }
        />
      </div>

      {isPoolDrawerOpen && selectedPool && (
        <DepositPoolDrawer
          isOpen={isPoolDrawerOpen}
          onOpenChange={setIsPoolDrawerOpen}
          selectedPool={selectedPool}
        />
      )}
    </div>
  );
}
