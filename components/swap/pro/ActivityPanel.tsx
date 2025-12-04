"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

type TabType = "Activity" | "Discussion";

interface Transaction {
  type: "Buy" | "Sell";
  apr?: string;
  tvl?: string;
  time: string;
  address?: string;
  value1?: string;
  value2?: string;
  txn: string;
}

const mockTransactions: Transaction[] = [
  {
    type: "Sell",
    time: "1s ago",
    txn: "0xe3c6...19e3",
  },
  {
    type: "Buy",
    apr: "12.5%",
    tvl: "$1.2M",
    time: "16s",
    address: "0xa6b5...57a5",
    value1: "$0.000014",
    value2: "$0.002890",
    txn: "0xe224...fcb5",
  },
  {
    type: "Sell",
    apr: "8.3%",
    tvl: "$850K",
    time: "32s",
    address: "0x1f2a...9c3d",
    value1: "$0.000021",
    value2: "$0.001234",
    txn: "0x4d5e...a1b2",
  },
  {
    type: "Buy",
    time: "45s",
    txn: "0x7c8d...3e4f",
  },
  {
    type: "Sell",
    apr: "15.2%",
    tvl: "$2.1M",
    time: "1m",
    address: "0x9e0f...5a6b",
    value1: "$0.000045",
    value2: "$0.005678",
    txn: "0x2b3c...7d8e",
  },
  {
    type: "Buy",
    apr: "9.7%",
    tvl: "$950K",
    time: "2m",
    address: "0x3c4d...6e7f",
    value1: "$0.000012",
    value2: "$0.001567",
    txn: "0x5f6g...8h9i",
  },
];

export function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("Activity");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-900/50">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 pt-4">
        <button
          onClick={() => setActiveTab("Activity")}
          className={cn(
            text.hsb3(),
            "border-b-2 px-4 pb-2 transition-colors",
            activeTab === "Activity"
              ? "border-green-400 text-green-400"
              : "border-transparent text-gray-500 hover:text-gray-300",
          )}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab("Discussion")}
          className={cn(
            text.hsb3(),
            "border-b-2 px-4 pb-2 transition-colors",
            activeTab === "Discussion"
              ? "border-green-400 text-green-400"
              : "border-transparent text-gray-500 hover:text-gray-300",
          )}
        >
          Discussion
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
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
      </div>
    </div>
  );
}
