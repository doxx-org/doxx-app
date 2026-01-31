"use client";

import { ColumnDef } from "@tanstack/react-table";
import { numericSort } from "@/lib/utils/table";
import { Button } from "../ui/button";
import { SortHeader } from "../ui/table";
import { PoolRow } from "./rows/";
import { NumberRows } from "./rows/NumberRow";
import { Pool } from "./v2/types";

// Callback type for deposit action
export type OnDepositCallback = (pool: Pool) => void;

const depositButton = (pool: Pool, onDeposit?: OnDepositCallback) => {
  return (
    <Button
      className="bg-gray-800 text-gray-400 hover:bg-gray-700"
      onClick={() => {
        if (onDeposit) {
          onDeposit(pool);
        }
      }}
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
