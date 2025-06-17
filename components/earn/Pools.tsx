import { cn } from "@/lib/utils";
import { columns, Pool } from "./PoolColumn";
import { DataTable } from "../ui/data-table";
import { text } from "@/lib/text";

const data: Pool[] = [
  {
    id: "1",
    pool: {
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
    pool: {
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
    pool: {
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
  return (
    <div className='flex flex-col gap-4'>
      <h1 className={cn(text.it1(), "text-green")}>All Pools</h1>
      <div className='container w-full min-h-[660px] h-full'>
        <DataTable columns={columns} data={data} />
      </div>
    </div>
  );
}
