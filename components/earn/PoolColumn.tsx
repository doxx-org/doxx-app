"use client";

import { ColumnDef } from "@tanstack/react-table";
import BN from "bn.js";
import { TokenProfile } from "@/lib/config/tokens";
import { PoolState } from "@/lib/hooks/chain/types";
import { numericSort } from "@/lib/utils/table";
import { Button } from "../ui/button";
import { SortHeader } from "../ui/table";
import { PoolRow } from "./rows/";
import { NumberRows } from "./rows/NumberRow";
import { PoolType } from "./v2/types";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Pool = {
  poolId: string;
  fee: BN;
  lpToken: {
    token1: TokenProfile;
    token2: TokenProfile;
  };
  apr: number; // in percentage
  tvl: number; // in usd
  dailyVol: number; // in usd
  dailyVolperTvl: number; // in percentage
  reward24h: number; // in usd
  poolState: PoolState; // Optional: actual pool state from chain
  price: number;
  poolType: PoolType;
};

// Callback type for deposit action
export type OnDepositCallback = (pool: Pool) => void;

const depositButton = (pool: Pool, onDeposit?: OnDepositCallback) => {
  return (
    <Button
      className="bg-gray-800 text-gray-400 hover:bg-gray-700"
      onClick={() => {
        if (pool.poolState && onDeposit) {
          onDeposit(pool);
        }
      }}
      disabled={!pool.poolState}
    >
      Deposit
    </Button>
  );
};

export const createColumns = (
  onDeposit?: OnDepositCallback,
): ColumnDef<Pool>[] => [
  {
    id: "poolName",
    header: "Pool",
    cell: ({ row }) => <PoolRow pool={row.original} />,
    accessorFn: (row) =>
      `${row.lpToken.token1.symbol}/${row.lpToken.token2.symbol}`,
    enableGlobalFilter: true,
  },
  {
    id: "apr",
    accessorKey: "apr",
    header: ({ column }) => <SortHeader column={column} header="APR" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.apr.toString()} displayValue="percent" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "tvl",
    accessorKey: "tvl",
    header: ({ column }) => <SortHeader column={column} header="TVL" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.tvl.toString()} displayValue="dollar" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "dailyVol",
    accessorKey: "dailyVol",
    header: ({ column }) => <SortHeader column={column} header="Volume 24h" />,
    cell: ({ row }) => (
      <NumberRows
        value={row.original.dailyVol.toString()}
        displayValue="dollar"
      />
    ),
    sortingFn: numericSort,
  },
  {
    id: "dailyVolperTvl",
    accessorKey: "dailyVolperTvl",
    header: ({ column }) => <SortHeader column={column} header="1D Vol/TVL" />,
    cell: ({ row }) => (
      <NumberRows
        value={row.original.dailyVolperTvl.toString()}
        displayValue="percent"
      />
    ),
    sortingFn: numericSort,
  },
  {
    id: "action",
    enableHiding: false,
    cell: ({ row }) => depositButton(row.original, onDeposit),
  },
];

// Default columns for backwards compatibility
export const columns = createColumns();
