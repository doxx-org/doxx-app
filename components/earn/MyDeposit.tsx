"use client";

import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { DataTable } from "../ui/data-table";
import { Deposit, columns } from "./MyDepositColumn";

// async function getData(): Promise<Deposit[]> {
//   // Fetch data from your API here.
//   return [];
// }

const data: Deposit[] = [];

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
