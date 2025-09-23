"use client";

import { useState } from "react";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { CreatePoolDialog } from "./CreatePoolDialog";
import { Pool, columns } from "./PoolColumn";

const data: Pool[] = [
  {
    id: "1",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "LAYER",
        image: "/coins/layer.svg",
      },
      token2: {
        name: "sUSD",
        image: "/coins/susd.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
  {
    id: "2",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "sSOL",
        image: "/coins/ssol.svg",
      },
      token2: {
        name: "sUSD",
        image: "/coins/susd.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
  {
    id: "3",
    account: "5w1cUnWz2edZW8g4YWrFejNDqChKYuWpy6B8okBYkkh2",
    fee: "0.04",
    lpToken: {
      token1: {
        name: "LAYER",
        image: "/coins/layer.svg",
      },
      token2: {
        name: "USDC",
        image: "/coins/usdc.svg",
      },
    },
    apr: "10",
    tvl: "200000000.00",
    dailyVol: "200000000.00",
    dailyVolperTvl: "10",
  },
];

export function Pools() {
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className={cn(text.it1(), "text-green")}>All Pools</h1>
        <Button
          className={cn(
            text.hsb2(),
            "text-green flex flex-row items-center justify-center",
          )}
          onClick={() => setIsCreatePoolOpen(true)}
        >
          Create Pool
        </Button>
      </div>
      <div className="h-full min-h-[660px] w-full">
        <DataTable columns={columns} data={data} />
      </div>

      {/* Create Pool Dialog */}
      {isCreatePoolOpen && (
        <CreatePoolDialog
          isOpen={isCreatePoolOpen}
          onOpenChange={setIsCreatePoolOpen}
        />
      )}
    </div>
  );
}
