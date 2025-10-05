"use client";

import { useState, useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { PoolState } from "@/lib/hooks/chain/types";
import { tokenProfiles } from "@/lib/config/tokens";
import { getPoolAddress } from "@/lib/utils/instructions";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { CreatePoolDialog } from "./CreatePoolDialog";
import { DepositDialog } from "./DepositDialog";
import { Pool, createColumns } from "./PoolColumn";

const data: Pool[] = [
  {
    id: "1",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "LAYER",
        image: "/coins/layer.svg",
      },
      token2: {
        name: "sUSD",
        image: "/coins/susd.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
  {
    id: "2",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "sSOL",
        image: "/coins/ssol.svg",
      },
      token2: {
        name: "sUSD",
        image: "/coins/susd.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
  {
    id: "3",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "LAYER",
        image: "/coins/layer.svg",
      },
      token2: {
        name: "USDC",
        image: "/coins/usdc.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
];

export function Pools() {
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolState | null>(null);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(null);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });
  
  // Fetch all pools
  const { data: poolsData, isLoading } = useGetAllPools(doxxAmmProgram);

  // Transform pool data from chain to table format
  const transformedPools = useMemo<Pool[]>(() => {
    if (!poolsData || !doxxAmmProgram) return data; // Fallback to mock data

    return poolsData.map((poolData, index) => {
      const { poolState, ammConfig } = poolData;
      
      // Find token profiles
      const token0Profile = tokenProfiles.find(
        (t) => t.address === poolState.token0Mint.toBase58()
      );
      const token1Profile = tokenProfiles.find(
        (t) => t.address === poolState.token1Mint.toBase58()
      );

      // Calculate pool address
      const [poolAddress] = getPoolAddress(
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token1Mint,
        doxxAmmProgram.programId
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
            "text-green flex flex-row items-center justify-center",
          )}
          onClick={() => setIsCreatePoolOpen(true)}
        >
          Create Pool
        </Button>
      </div>
      <div className="h-full min-h-[660px] w-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400">Loading pools...</span>
          </div>
        ) : (
          <DataTable columns={poolColumns} data={transformedPools} />
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
