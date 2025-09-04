"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "../ui/button";
import { SortColumn } from "./cols/sortColomn";
import { PoolRow } from "./rows/";
import { NumberRows } from "./rows/NumberRow";

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
};

const depositButton = (poolAccount: string) => {
  return (
    <Button className="bg-gray-800 text-gray-400 hover:bg-gray-800">
      <Link href={`/deposit/${poolAccount}`}>Deposit</Link>
    </Button>
  );
};

export const columns: ColumnDef<Pool>[] = [
  {
    id: "poolName",
    accessorKey: "pool",
    header: "Pool",
    cell: ({ row }) => <PoolRow pool={row.original} />,
  },
  {
    id: "apr",
    accessorKey: "apr",
    header: () => <SortColumn header="APR" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.apr} displayValue="percent" />
    ),
  },
  {
    id: "tvl",
    accessorKey: "tvl",
    header: () => <SortColumn header="TVL" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.tvl} displayValue="dollar" />
    ),
  },
  {
    id: "dailyVol",
    accessorKey: "dailyVol",
    header: () => <SortColumn header="Volume 24h" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.dailyVol} displayValue="dollar" />
    ),
  },
  {
    id: "dailyVolperTvl",
    accessorKey: "dailyVolperTvl",
    header: () => <SortColumn header="1D Vol/TVL" />,
    cell: ({ row }) => (
      <NumberRows value={row.original.dailyVolperTvl} displayValue="percent" />
    ),
  },
  {
    id: "action",
    enableHiding: false,
    cell: ({ row }) => depositButton(row.original.account),
  },
];
