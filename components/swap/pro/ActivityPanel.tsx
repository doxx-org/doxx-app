"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { text } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";
import { cn } from "@/lib/utils/style";
import { numericSort } from "@/lib/utils/table";

enum TabType {
  Activity = "Activity",
  Discussion = "Discussion",
}

enum PoolActivityType {
  Buy = "Buy",
  Sell = "Sell",
}

interface PoolActivity {
  type: PoolActivityType;
  apr?: string;
  tvl?: string;
  time: number;
  address: string;
  txn: string;
}

const mockActivities: PoolActivity[] = [
  {
    type: PoolActivityType.Sell,
    time: new Date().getTime() - 1000,
    address: "0xe3c6xxxxxxxxx19e3",
    txn: "0xe3c6xxxxxxxxx19e3",
  },
  {
    type: PoolActivityType.Buy,
    apr: "12.5%",
    tvl: "$1.2M",
    time: new Date().getTime() - 16000,
    address: "0xa6b5xxxxxxxxx57a5",
    txn: "0xe224xxxxxxxxxfcb5",
  },
  {
    type: PoolActivityType.Sell,
    apr: "8.3%",
    tvl: "$850K",
    time: new Date().getTime() - 32000,
    address: "0x1f2axxxxxxxxx9c3d",
    txn: "0x4d5exxxxxxxxxa1b2",
  },
  {
    type: PoolActivityType.Buy,
    time: new Date().getTime() - 45000,
    txn: "0x7c8dxxxxxxxxx3e4f",
    address: "0x7c8dxxxxxxxxx3e4f",
  },
  {
    type: PoolActivityType.Sell,
    apr: "15.2%",
    tvl: "$2.1M",
    time: new Date().getTime() - 60000,
    address: "0x9e0fxxxxxxxxx5a6b",
    txn: "0x2b3cxxxxxxxxx7d8e",
  },
  {
    type: PoolActivityType.Buy,
    apr: "9.7%",
    tvl: "$950K",
    time: new Date().getTime() - 120000,
    address: "0x3c4dxxxxxxxxx6e7f",
    txn: "0x5f6gxxxxxxxxx8h9i",
  },

  {
    type: PoolActivityType.Sell,
    time: new Date().getTime() - 1000,
    address: "0xe3c6xxxxxxxxx19e3",
    txn: "0xe3c6xxxxxxxxx19e3",
  },
  {
    type: PoolActivityType.Buy,
    apr: "12.5%",
    tvl: "$1.2M",
    time: new Date().getTime() - 16000,
    address: "0xa6b5xxxxxxxxx57a5",
    txn: "0xe224xxxxxxxxxfcb5",
  },
  {
    type: PoolActivityType.Sell,
    apr: "8.3%",
    tvl: "$850K",
    time: new Date().getTime() - 32000,
    address: "0x1f2axxxxxxxxx9c3d",
    txn: "0x4d5exxxxxxxxxa1b2",
  },
  {
    type: PoolActivityType.Buy,
    time: new Date().getTime() - 45000,
    txn: "0x7c8dxxxxxxxxx3e4f",
    address: "0x7c8dxxxxxxxxx3e4f",
  },
  {
    type: PoolActivityType.Sell,
    apr: "15.2%",
    tvl: "$2.1M",
    time: new Date().getTime() - 60000,
    address: "0x9e0fxxxxxxxxx5a6b",
    txn: "0x2b3cxxxxxxxxx7d8e",
  },
  {
    type: PoolActivityType.Buy,
    apr: "9.7%",
    tvl: "$950K",
    time: new Date().getTime() - 120000,
    address: "0x3c4dxxxxxxxxx6e7f",
    txn: "0x5f6gxxxxxxxxx8h9i",
  },
];

export const columns: ColumnDef<PoolActivity>[] = [
  {
    id: "type",
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span
        className={cn(
          text.sb5(),
          "flex w-9 items-center justify-center rounded-[6px] py-1.5",
          row.original.type === PoolActivityType.Buy
            ? "text-green bg-green/10"
            : "text-red-light bg-red-light/10",
        )}
      >
        {row.original.type}
      </span>
    ),
  },
  {
    id: "address",
    accessorKey: "address",
    header: "Account",
    cell: ({ row }) => (
      <div>
        <span
          className={cn(
            text.r3(),
            "text-gray-300 hover:cursor-pointer hover:text-gray-200 hover:underline",
          )}
        >
          {ellipseAddress(row.original.address)}
        </span>
      </div>
    ),
  },
  {
    id: "apr",
    accessorKey: "apr",
    header: ({ column }) => (
      <SortHeader
        column={column}
        header="APR"
        className="hover:!stroke-gray-500 hover:text-gray-500"
      />
    ),
    cell: ({ row }) => (
      <div className={cn(text.r3(), "text-gray-300")}>{row.original.apr}</div>
    ),
    sortingFn: numericSort,
  },
  {
    id: "tvl",
    accessorKey: "tvl",
    header: ({ column }) => (
      <SortHeader
        column={column}
        header="TVL"
        className="hover:!stroke-gray-500 hover:text-gray-500"
      />
    ),
    cell: ({ row }) => (
      <div className={cn(text.r3(), "text-gray-300")}>{row.original.tvl}</div>
    ),
    sortingFn: numericSort,
  },
  {
    id: "time",
    header: ({ column }) => (
      <SortHeader
        column={column}
        header="Time"
        className="hover:!stroke-gray-500 hover:text-gray-500"
      />
    ),
    cell: ({ row }) => (
      <div className={cn(text.r3(), "text-gray-300")}>
        {new Date(row.original.time).toLocaleString()}
      </div>
    ),
    sortingFn: numericSort,
  },
  {
    id: "txn",
    accessorKey: "txn",
    header: "Txn",
    cell: ({ row }) => (
      <div
        className={cn(
          text.r3(),
          "flex items-center justify-end gap-1 text-gray-300 hover:text-gray-200 hover:underline",
        )}
      >
        <span className="hover:cursor-pointer">
          {ellipseAddress(row.original.txn)}
        </span>
        <ExternalLink className="h-3.5 w-3.5 hover:cursor-pointer" />
      </div>
    ),
  },
];

export function ActivityPanel() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState<TabType>(TabType.Activity);

  return (
    <div className="bg-black-900 flex h-full flex-col overflow-hidden border-t-2 border-gray-800">
      {/* Tabs */}
      <Tabs
        defaultValue={TabType.Activity}
        className="flex h-full flex-col gap-0"
      >
        <TabsList className="w-full flex-shrink-0 justify-start rounded-none border-b border-gray-800">
          <TabsTrigger
            onClick={() => setActiveTab(TabType.Activity)}
            value={TabType.Activity}
            className="w-30"
          >
            {TabType.Activity}
          </TabsTrigger>
          <TabsTrigger
            onClick={() => setActiveTab(TabType.Discussion)}
            value={TabType.Discussion}
            className="w-30"
          >
            {TabType.Discussion}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value={TabType.Activity}
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          <DataTable
            columns={columns}
            data={mockActivities}
            className={{
              outer: "bg-black-900 relative h-full overflow-y-auto",
              table: {
                headers: {
                  row: "bg-black-900 hover:!bg-black-900 sticky top-0 z-10 border-b border-gray-800",
                  head: "!rounded-none !border-none",
                },
                body: {
                  row: "!border-none",
                  cell: "!border-white/10",
                },
              },
            }}
            isShowPagination={false}
          />
        </TabsContent>
        <TabsContent
          value={TabType.Discussion}
          className="min-h-0 flex-1 overflow-hidden"
        >
          TODO: Discussion Content
        </TabsContent>
      </Tabs>

      {/* <div className="flex items-center gap-2 border-b border-gray-800 px-4 pt-4">
        <button
          onClick={() => setActiveTab(TabType.Discussion)}
          className={cn(
            text.hsb3(),
            "border-b-2 px-4 pb-2 transition-colors",
            activeTab === TabType.Discussion
              ? "border-white text-white"
              : "border-transparent text-gray-500 hover:text-gray-300",
          )}
        >
          Discussion
        </button>
      </div> */}

      {/* Content */}
      {/* <div className="px-4 pb-4">
        {activeTab === "Activity" ? (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className={cn(text.sb3(), "text-gray-500")}>
                  Type
                </TableHead>
                <TableHead className={cn(text.sb3(), "text-gray-500")}>
                  APR
                </TableHead>
                <TableHead className={cn(text.sb3(), "text-gray-500")}>
                  TVL
                </TableHead>
                <TableHead className={cn(text.sb3(), "text-gray-500")}>
                  Time
                </TableHead>
                <TableHead className={cn(text.sb3(), "text-gray-500")}>
                  Txn
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransactions.map((tx, index) => (
                <TableRow
                  key={index}
                  className="border-gray-800 hover:bg-gray-800/50"
                >
                  <TableCell>
                    <Badge
                      variant={tx.type === "Buy" ? "default" : "destructive"}
                      className={cn(
                        text.sb3(),
                        tx.type === "Buy"
                          ? "bg-green/20 text-green-400"
                          : "bg-red/20 text-red-400",
                      )}
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(text.sb3(), "text-gray-400")}>
                    {tx.apr || "-"}
                  </TableCell>
                  <TableCell className={cn(text.sb3(), "text-gray-400")}>
                    {tx.tvl || "-"}
                  </TableCell>
                  <TableCell className={cn(text.sb3(), "text-gray-400")}>
                    {tx.time}
                    {tx.address && (
                      <div className={cn(text.sb3(), "mt-1 text-gray-500")}>
                        {tx.address}
                      </div>
                    )}
                    {tx.value1 && tx.value2 && (
                      <div className={cn(text.sb3(), "mt-1 text-gray-400")}>
                        {tx.value1} / {tx.value2}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      className={cn(
                        text.sb3(),
                        "text-green-400 hover:text-green-300 hover:underline",
                      )}
                      onClick={() => {
                        // In a real app, this would open the transaction in explorer
                        console.log("View transaction:", tx.txn);
                      }}
                    >
                      {tx.txn}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className={cn(text.sb3(), "text-gray-500")}>
              Discussion feature coming soon
            </div>
          </div>
        )}
      </div> */}
    </div>
  );
}
