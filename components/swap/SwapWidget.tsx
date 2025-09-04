"use client";

import { useState } from "react";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import ArrowRight from "@/assets/icons/arrow-right.svg";
import Gear from "@/assets/icons/gear.svg";
import Info from "@/assets/icons/info.svg";
import Zap from "@/assets/icons/zap.svg";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { parseDecimalsInput } from "@/lib/utils";
import { ConnectButton } from "../ConnectBtn";
import { Separator } from "../ui/separator";
import { SwapInput } from "./SwapInput";

const coinOptions = [
  {
    value: "LAYER",
    symbol: "LAYER",
    image: "/coins/layer.svg",
  },
  {
    value: "sUSD",
    symbol: "sUSD",
    image: "/coins/susd.svg",
  },
  {
    value: "USDC",
    symbol: "USDC",
    image:
      "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
  },
  {
    value: "sSOL",
    symbol: "sSOL",
    image: "/coins/ssol.svg",
  },
];

export function SwapWidget() {
  const [sellCoin, setSellCoin] = useState(coinOptions[0].value);
  const [buyCoin, setBuyCoin] = useState(coinOptions[1].value);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

  return (
    <Card className="flex flex-col rounded-2xl p-0">
      <CardHeader className="flex flex-1 flex-row items-center gap-2 border-b border-gray-800 p-6">
        <Zap />
        <CardTitle>Instant Swap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-3">
        <div className="flex w-full flex-row items-center justify-end">
          <Gear />
        </div>
        <div className="relative flex flex-col gap-1">
          <SwapInput
            coin={sellCoin}
            coinOptions={coinOptions}
            amount={sellAmount}
            onAmountChange={(value) => setSellAmount(parseDecimalsInput(value))}
            onCoinChange={setSellCoin}
          />
          <button
            type="button"
            className="bg-black-700 hover:bg-black-800 absolute top-1/2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-800 p-1 transition-colors"
            onClick={() => {
              setSellCoin(buyCoin);
              setBuyCoin(sellCoin);
            }}
            aria-label="Swap tokens"
          >
            <ArrowDown className="transition-transform hover:rotate-180" />
          </button>
          <SwapInput
            className="rounded-none rounded-b-xl"
            coin={buyCoin}
            coinOptions={coinOptions}
            amount={buyAmount}
            onAmountChange={(value) => setBuyAmount(parseDecimalsInput(value))}
            onCoinChange={setBuyCoin}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>1 SOL</p>
              <ArrowRight />
              <p>1000.00 USDC</p>
            </div>
            <p>= 1000.00 USDC</p>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>Routing</p>
              <Info />
            </div>
            <p>CLOB</p>
          </div>
          <Separator className="bg-gray-800" />
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>Slippage</p>
              <Info />
            </div>
            <p>0.5%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-row items-center justify-between p-3">
        <ConnectButton
          className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
        />
      </CardFooter>
    </Card>
  );
}
