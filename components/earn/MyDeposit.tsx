"use client";
import { cn } from "@/lib/utils";
import { columns, Deposit } from "./MyDepositColumn";
import { DataTable } from "../ui/data-table";
import { text } from "@/lib/text";

// async function getData(): Promise<Deposit[]> {
//   // Fetch data from your API here.
//   return [];
// }

const data: Deposit[] = [];

export function MyDeposit() {
  return (
    <div className='flex flex-col gap-4'>
      <h1 className={cn(text.it1(), "text-green")}>My Deposit</h1>
      <div className='container w-full min-h-[178px]'>
        <DataTable columns={columns} data={data} />
      </div>
    </div>
  );
}
