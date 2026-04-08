"use client";

import { ColumnDef } from "@tanstack/react-table";
import { numericSort } from "@/lib/utils/table";
import { SortHeader } from "@/components/ui/table";
import { PoolRow } from "@/components/earn/rows/PoolRow";
import { NumberRows } from "@/components/earn/rows/NumberRow";
import { PriceRangeCell } from "./PriceRangeCell";
import { UnifiedPositionRow } from "./types";

export const positionColumns: ColumnDef<UnifiedPositionRow>[] = [
  {
    id: "position",
    header: "Position",
    cell: ({ row }) => <PoolRow pool={row.original.pool} />,
    accessorFn: (row) => `${row.token1.symbol}/${row.token2.symbol}`,
  },
  {
    id: "positionValue",
    accessorKey: "positionValue",
    header: ({ column }) => <SortHeader column={column} header="Balance" />,
    cell: ({ row }) => (
      <NumberRows
        value={row.original.positionValue.toString()}
        displayValue="dollar"
      />
    ),
    sortingFn: numericSort,
  },
  {
    id: "apr",
    accessorKey: "apr",
    header: ({ column }) => <SortHeader column={column} header="Est. APY%" />,
    cell: ({ row }) => (
      <NumberRows
        value={row.original.apr?.toString()}
        displayValue="percent"
      />
    ),
    sortingFn: numericSort,
  },
  {
    id: "totalPendingYieldUsd",
    accessorKey: "totalPendingYieldUsd",
    header: ({ column }) => (
      <SortHeader column={column} header="Pending Yield" />
    ),
    cell: ({ row }) => (
      <NumberRows
        value={row.original.totalPendingYieldUsd.toString()}
        displayValue="dollar"
      />
    ),
    sortingFn: numericSort,
  },
  {
    id: "priceRange",
    header: "Price Range",
    cell: ({ row }) => <PriceRangeCell row={row.original} />,
    enableSorting: false,
  },
];
