"use client";

import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { DataTable } from "../ui/data-table";
import { Deposit, columns } from "./MyDepositColumn";

// async function getData(): Promise<Deposit[]> {
//   // Fetch data from your API here.
//   return [];
// }

const data: Deposit[] = [
  {
    id: "1",
    tokenName: "LAYER/sUSD",
    depositAmount: "12450.00",
    shareAmount: "0.51",
    tokenAmount: "5230.45",
  },
  {
    id: "2",
    tokenName: "sSOL/sUSD",
    depositAmount: "8920.00",
    shareAmount: "0.16",
    tokenAmount: "3125.80",
  },
  {
    id: "3",
    tokenName: "LAYER/USDC",
    depositAmount: "3580.00",
    shareAmount: "0.28",
    tokenAmount: "1890.20",
  },
  {
    id: "4",
    tokenName: "sSOL/USDC",
    depositAmount: "6750.00",
    shareAmount: "0.34",
    tokenAmount: "2840.15",
  },
  {
    id: "5",
    tokenName: "LAYER/sSOL",
    depositAmount: "4200.00",
    shareAmount: "0.22",
    tokenAmount: "1680.90",
  },
  {
    id: "6",
    tokenName: "sUSD/USDC",
    depositAmount: "15800.00",
    shareAmount: "0.68",
    tokenAmount: "7920.50",
  },
  {
    id: "7",
    tokenName: "LAYER/sUSD",
    depositAmount: "2150.00",
    shareAmount: "0.09",
    tokenAmount: "905.30",
  },
  {
    id: "8",
    tokenName: "sSOL/sUSD",
    depositAmount: "9870.00",
    shareAmount: "0.17",
    tokenAmount: "3450.25",
  },
];

export function MyDeposit() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={cn(text.it1(), "text-green")}>My Deposit</h1>
      <div className="min-h-[178px] w-full">
        <DataTable columns={columns} data={data} />
      </div>
    </div>
  );
}
