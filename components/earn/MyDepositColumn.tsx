"use client";

import { ColumnDef } from "@tanstack/react-table";

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
    accessorKey: "tokenName",
    header: "Token Name",
  },
  {
    accessorKey: "depositAmount",
    header: "Deposited",
  },
  {
    accessorKey: "shareAmount",
    header: "Share of Pool",
  },
  {
    accessorKey: "tokenAmount",
    header: "Token Amount",
  },
];
