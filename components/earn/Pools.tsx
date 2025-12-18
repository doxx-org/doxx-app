"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  RawTokenProfile,
  knownTokenProfiles,
  unknownToken,
} from "@/lib/config/tokens";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { DataTable } from "../ui/data-table";
import { SearchInput } from "../ui/search-input";
// import { CreatePoolDialog } from "./CreateCPMMPoolDialog";
import { Pool, createColumns } from "./PoolColumn";
import { DepositPoolDrawer } from "./v2/DepositPoolDrawer";
import { PoolType } from "./v2/types";

export function Pools() {
  const [searchValue, setSearchValue] = useState("");
  const [_isDepositDialogOpen, _setIsDepositDialogOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  // const [selectedPool, setSelectedPool] = useState<PoolState | null>(null);
  // const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(
  //   null,
  // );
  const [isPoolDrawerOpen, setIsPoolDrawerOpen] = useState(false);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });

  // Fetch all pools
  const {
    data: poolsData,
    isLoading: isLoadingPools,
    // TODO: add refetchAllPoolStates to the dependencies
    // refetch: refetchAllPoolStates,
  } = useGetAllPools(doxxAmmProgram);

  // Fetch token balances
  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    knownTokenProfiles,
    true,
  );

  const rawTokenProfilesFromSplBalances: RawTokenProfile[] | undefined =
    useMemo(() => {
      if (!splBalances) return undefined;

      const allBalances = Object.values(splBalances).filter((c) => !!c);

      return allBalances.map((b) => {
        return {
          address: b.mint,
          decimals: b.decimals,
        };
      });
    }, [splBalances]);

  const { data: allTokenProfiles, isLoading: _isLoadingAllTokenProfiles } =
    useGetAllTokenInfos(poolsData, rawTokenProfilesFromSplBalances);

  // Transform pool data from chain to table format
  const transformedPools = useMemo<Pool[]>(() => {
    if (!poolsData || !allTokenProfiles) return []; // Fallback to mock data

    return poolsData.map((poolData, index) => {
      const { poolState, ammConfig } = poolData;

      // Find token profiles
      const token0Profile = allTokenProfiles.find(
        (t) => t.address === poolState.token0Mint.toBase58(),
      ) ?? {
        ...unknownToken,
        address: poolState.token0Mint.toBase58(),
      };
      const token1Profile = allTokenProfiles.find(
        (t) => t.address === poolState.token1Mint.toBase58(),
      ) ?? {
        ...unknownToken,
        address: poolState.token1Mint.toBase58(),
      };

      const poolAddress = poolData.observationState.poolId;

      // Calculate fee percentage from tradeFeeRate (basis points)
      // const feePercent = normalizeBPSString(ammConfig.tradeFeeRate.toString());

      return {
        id: index.toString(),
        account: poolAddress.toBase58(),
        fee: ammConfig.tradeFeeRate,
        lpToken: {
          token1: token0Profile,
          token2: token1Profile,
        },
        apr: 10, // Placeholder - calculate from fees/TVL
        tvl: 0, // Placeholder - fetch from vault balances
        dailyVol: 0, // Placeholder - fetch from analytics
        dailyVolperTvl: 0, // Placeholder
        reward24h: 0.001, // Placeholder - fetch from analytics
        poolState, // IMPORTANT: Include the actual pool state for deposit
        // TODO: fetch from pool state
        price: 0.301,
        poolType: PoolType.CPMM, // Placeholder - fetch from pool state
      };
    });
  }, [poolsData, allTokenProfiles]);

  const handleOpenDeposit = (pool: Pool) => {
    setSelectedPool(pool);
    // setSelectedPoolAddress(poolAddress);
    setIsPoolDrawerOpen(true);
  };

  const poolColumns = createColumns(handleOpenDeposit);

  return (
    <div className="flex flex-col gap-4">
      {/* <div className="flex flex-row items-center justify-between">
        <h1 className={cn(text.it1(), "text-green")}>All Pools</h1>
        <Button
          className={cn(
            text.hsb2(),
            "text-green flex flex-row items-center justify-center gap-2 rounded-2xl",
          )}
          onClick={() => setIsCreatePoolOpen(true)}
        >
          <Plus className="mt-1" />
          Create Pool
        </Button>
      </div> */}
      <div className="h-full min-h-[660px] w-full">
        {isLoadingPools ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-400">Loading pools...</span>
          </div>
        ) : (
          <DataTable
            columns={poolColumns}
            data={transformedPools} // seems like real data didn't work.
            globalFilter={searchValue}
            pageSize={10}
            searchInput={
              <SearchInput
                value={searchValue}
                onChange={setSearchValue}
                placeholder="Search pool or token"
              />
            }
          />
        )}
      </div>

      {isPoolDrawerOpen && selectedPool && (
        <DepositPoolDrawer
          isOpen={isPoolDrawerOpen}
          onOpenChange={setIsPoolDrawerOpen}
          selectedPool={selectedPool}
        />
      )}

      {/* Create Pool Dialog
      {isCreatePoolOpen && !isLoadingAllTokenProfiles && allTokenProfiles && (
        <CreatePoolDialog
          isOpen={isCreatePoolOpen}
          splBalances={splBalances}
          allTokenProfiles={allTokenProfiles}
          onOpenChange={setIsCreatePoolOpen}
        />
      )} */}

      {/* Deposit Dialog
      {isDepositDialogOpen && (
        <DepositDialog
          isOpen={isDepositDialogOpen}
          onOpenChange={setIsDepositDialogOpen}
          poolState={selectedPool}
          poolStateAddress={selectedPoolAddress}
        />
      )} */}
    </div>
  );
}
