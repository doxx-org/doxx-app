"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PoolState } from "@/lib/hooks/chain/types";
import { Button } from "../ui/button";
import { SortHeader } from "./cols/sortColomn";
import { PoolRow } from "./rows/";
import { NumberRows } from "./rows/NumberRow";
import { numericSort } from "@/lib/utils/table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
type Token = {
  name: string;
  image: string;
};
export type Pool = {
  id: string;
  account: string;
  fee: string;
  lpToken: {
    token1: Token;
    token2: Token;
  };
  apr: string;
  tvl: string;
  dailyVol: string;
  dailyVolperTvl: string;
  poolState?: PoolState; // Optional: actual pool state from chain
};

// Callback type for deposit action
export type OnDepositCallback = (poolState: PoolState, poolAddress: string) => void;

const depositButton = (pool: Pool, onDeposit?: OnDepositCallback) => {
  return (
    <Button 
      className="bg-gray-800 text-gray-400 hover:bg-gray-700"
      onClick={() => {
        if (pool.poolState && onDeposit) {
          onDeposit(pool.poolState, pool.account);
        }
      }}
      disabled={!pool.poolState}
    >
      Deposit
    </Button>
  );
};

export const createColumns = (onDeposit?: OnDepositCallback): ColumnDef<Pool>[] => [
  {
    id: "poolName",
    header: "Pool",
    cell: ({ row }) => <PoolRow pool={row.original} />,
    accessorFn: (row) =>
      `${row.lpToken.token1.name}/${row.lpToken.token2.name}`,
    enableGlobalFilter: true,
  },
  {
    id: "apr",
    accessorKey: "apr",
    header: ({ column }) => <SortHeader column={column} header="APR" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.apr} displayValue="percent" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "tvl",
    accessorKey: "tvl",
    header: ({ column }) => <SortHeader column={column} header="TVL" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.tvl} displayValue="dollar" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "dailyVol",
    accessorKey: "dailyVol",
    header: ({ column }) => <SortHeader column={column} header="Volume 24h" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.dailyVol} displayValue="dollar" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "dailyVolperTvl",
    accessorKey: "dailyVolperTvl",
    header: ({ column }) => <SortHeader column={column} header="1D Vol/TVL" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.dailyVolperTvl} displayValue="percent" />
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
