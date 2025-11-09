"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import Plus from "@/assets/icons/table/plus.svg";
import { knownTokenProfiles } from "@/lib/config/tokens";
import { PoolState } from "@/lib/hooks/chain/types";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { text } from "@/lib/text";
import { getPoolAddress } from "@/lib/utils/instructions";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { SearchInput } from "../ui/search-input";
import { CreatePoolDialog } from "./CreatePoolDialog";
import { DepositDialog } from "./DepositDialog";
import { Pool, createColumns } from "./PoolColumn";
import { columns } from "./PoolColumn";
import { mockPoolsData } from "./mock-pools-data";

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
  const { data: poolsData, isLoading } = useGetAllPools(doxxAmmProgram);

  // Transform pool data from chain to table format
  const transformedPools = useMemo<Pool[]>(() => {
    if (!poolsData || !doxxAmmProgram) return mockPoolsData; // Fallback to mock data

    return poolsData.map((poolData, index) => {
      const { poolState, ammConfig } = poolData;

      // Find token profiles
      const token0Profile = knownTokenProfiles.find(
        (t) => t.address === poolState.token0Mint.toBase58(),
      );
      const token1Profile = knownTokenProfiles.find(
        (t) => t.address === poolState.token1Mint.toBase58(),
      );

      // Calculate pool address
      const [poolAddress] = getPoolAddress(
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token1Mint,
        doxxAmmProgram.programId,
      );

      // Calculate fee percentage from tradeFeeRate (basis points)
      const feePercent = (Number(ammConfig.tradeFeeRate) / 10000).toFixed(2);

      return {
        id: index.toString(),
        account: poolAddress.toBase58(),
        fee: feePercent,
        lpToken: {
          token1: {
            name: token0Profile?.symbol || "Unknown",
            image: token0Profile?.image || "/coins/usdc.svg",
          },
          token2: {
            name: token1Profile?.symbol || "Unknown",
            image: token1Profile?.image || "/coins/usdc.svg",
          },
        },
        apr: "10", // Placeholder - calculate from fees/TVL
        tvl: "0.00", // Placeholder - fetch from vault balances
        dailyVol: "0.00", // Placeholder - fetch from analytics
        dailyVolperTvl: "0", // Placeholder
        poolState, // IMPORTANT: Include the actual pool state for deposit
      };
    });
  }, [poolsData, doxxAmmProgram]);

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
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-400">Loading pools...</span>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={mockPoolsData} // seems like real data didn't work.
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
