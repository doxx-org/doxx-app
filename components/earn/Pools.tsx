"use client";

import { useMemo, useState } from "react";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { DataTable } from "../ui/data-table";
import { SearchInput } from "../ui/search-input";
import { createColumns } from "./PoolColumn";
import { DepositPoolDrawer } from "./v2/DepositPoolDrawer";
import { Pool } from "./v2/types";

export function Pools() {
  const [searchValue, setSearchValue] = useState("");
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [isPoolDrawerOpen, setIsPoolDrawerOpen] = useState(false);

  // Hooks
  const {
    data: allPools,
    isLoading: isLoadingAllPools,
    refetch: refetchAllPools,
  } = useGetAllPools();

  const filteredPools = useMemo(() => {
    if (!searchValue || searchValue.trim() === "") return allPools;

    return allPools?.filter((pool) => {
      return [
        pool.lpToken.token1.name.toLowerCase(),
        pool.lpToken.token1.symbol.toLowerCase(),
        pool.lpToken.token1.address.toLowerCase(),
        pool.lpToken.token2.name.toLowerCase(),
        pool.lpToken.token2.symbol.toLowerCase(),
        pool.lpToken.token2.address.toLowerCase(),
        pool.poolId.toLowerCase(),
      ].some((field) => field.includes(searchValue.toLowerCase()));
    });
  }, [allPools, searchValue]);

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
          data={filteredPools ?? []}
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
