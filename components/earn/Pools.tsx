"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import Plus from "@/assets/icons/table/plus.svg";
import { knownTokenProfiles, unknownToken } from "@/lib/config/tokens";
import { PoolState } from "@/lib/hooks/chain/types";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { text } from "@/lib/text";
import { normalizeBPSString } from "@/lib/utils";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { SearchInput } from "../ui/search-input";
import { CreatePoolDialog } from "./CreatePoolDialog";
import { DepositDialog } from "./DepositDialog";
import { Pool, createColumns } from "./PoolColumn";

export function Pools() {
  const [searchValue, setSearchValue] = useState("");
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolState | null>(null);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(
    null,
  );

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });

  // Fetch all pools
  const {
    data: poolsData,
    isLoading: isLoadingPools,
    refetch: refetchAllPoolStates,
  } = useGetAllPools(doxxAmmProgram);

  const { data: allTokenProfiles, isLoading: isLoadingAllTokenProfiles } =
    useGetAllTokenInfos(poolsData, knownTokenProfiles);

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
      const feePercent = normalizeBPSString(ammConfig.tradeFeeRate.toString());

      return {
        id: index.toString(),
        account: poolAddress.toBase58(),
        fee: feePercent,
        lpToken: {
          token1: token0Profile,
          token2: token1Profile,
        },
        apr: "10", // Placeholder - calculate from fees/TVL
        tvl: "0.00", // Placeholder - fetch from vault balances
        dailyVol: "0.00", // Placeholder - fetch from analytics
        dailyVolperTvl: "0", // Placeholder
        poolState, // IMPORTANT: Include the actual pool state for deposit
      };
    });
  }, [poolsData, doxxAmmProgram, allTokenProfiles]);

  const handleOpenDeposit = (poolState: PoolState, poolAddress: string) => {
    setSelectedPool(poolState);
    setSelectedPoolAddress(poolAddress);
    setIsDepositDialogOpen(true);
  };

  const poolColumns = createColumns(handleOpenDeposit);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
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
      </div>
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

      {/* Create Pool Dialog */}
      {isCreatePoolOpen && (
        <CreatePoolDialog
          isOpen={isCreatePoolOpen}
          onOpenChange={setIsCreatePoolOpen}
        />
      )}

      {/* Deposit Dialog */}
      {isDepositDialogOpen && (
        <DepositDialog
          isOpen={isDepositDialogOpen}
          onOpenChange={setIsDepositDialogOpen}
          poolState={selectedPool}
          poolStateAddress={selectedPoolAddress}
        />
      )}
    </div>
  );
}
