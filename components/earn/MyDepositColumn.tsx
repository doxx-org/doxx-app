"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "./cols/sortColomn";
import { NumberRows } from "./rows/NumberRow";
import { numericSort } from "@/lib/utils/table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Deposit = {
  id: string;
  tokenName: string;
  depositAmount: string;
  shareAmount: string;
  tokenAmount: string;
};

export const columns: ColumnDef<Deposit>[] = [
  {
    id: "tokenName",
    accessorKey: "tokenName",
    header: "Token Name",
  },
  {
    id: "depositAmount",
    accessorKey: "depositAmount",
    header: ({ column }) => <SortHeader column={column} header="Deposited" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.depositAmount} displayValue="dollar" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "shareAmount",
    accessorKey: "shareAmount",
    header: ({ column }) => <SortHeader column={column} header="Share of Pool" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.shareAmount} displayValue="percent" />
    ),
    sortingFn: numericSort,
  },
  {
    id: "tokenAmount",
    accessorKey: "tokenAmount",
    header: ({ column }) => <SortHeader column={column} header="Token Amount" />,
    cell: ({ row }) => {
      const value = parseFloat(row.original.tokenAmount);
      return (
        <div className="text-right">
          {value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          LP
        </div>
      );
    },
    sortingFn: numericSort,
  },
];
