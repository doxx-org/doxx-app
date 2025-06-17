"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SortColumn } from "./cols/sortColomn";

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
    header: () => <SortColumn header='Deposited' />,
  },
  {
    id: "shareAmount",
    accessorKey: "shareAmount",
    header: () => <SortColumn header='Share of Pool' />,
  },
  {
    id: "tokenAmount",
    accessorKey: "tokenAmount",
    header: () => <SortColumn header='Token Amount' />,
  },
];
