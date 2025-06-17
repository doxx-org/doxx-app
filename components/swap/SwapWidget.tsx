"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SwapInput } from "./SwapInput";
import Zap from "@/assets/icons/zap.svg";
import Gear from "@/assets/icons/gear.svg";
import ArrowRight from "@/assets/icons/arrow-right.svg";
import Info from "@/assets/icons/info.svg";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import { cn, parseDecimalsInput } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { ConnectButton } from "../ConnectBtn";
import { text } from "@/lib/text";
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
    image: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
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
    <Card className='flex flex-col p-0 rounded-2xl'>
      <CardHeader className='flex flex-row items-center gap-2 flex-1 p-6 border-b border-gray-800'>
        <Zap />
        <CardTitle>Instant Swap</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4 p-3'>
        <div className='flex flex-row items-center w-full justify-end'>
          <Gear />
        </div>
        <div className='flex flex-col gap-1 relative'>
          <SwapInput
            coin={sellCoin}
            coinOptions={coinOptions}
            amount={sellAmount}
            onAmountChange={(value) => setSellAmount(parseDecimalsInput(value))}
            onCoinChange={setSellCoin}
          />
          <button
            type='button'
            className=' p-1 absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full border border-gray-800 bg-black-700 hover:bg-black-800 transition-colors'
            onClick={() => {
              setSellCoin(buyCoin);
              setBuyCoin(sellCoin);
            }}
            aria-label='Swap tokens'
          >
            <ArrowDown className='hover:rotate-180 transition-transform' />
          </button>
          <SwapInput
            className='rounded-none rounded-b-xl'
            coin={buyCoin}
            coinOptions={coinOptions}
            amount={buyAmount}
            onAmountChange={(value) => setBuyAmount(parseDecimalsInput(value))}
            onCoinChange={setBuyCoin}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <div className='flex flex-row items-center justify-between'>
            <div className='flex flex-row gap-1 items-center justify-center'>
              <p>1 SOL</p>
              <ArrowRight />
              <p>1000.00 USDC</p>
            </div>
            <p>= 1000.00 USDC</p>
          </div>
          <div className='flex flex-row items-center justify-between'>
            <div className='flex flex-row gap-1 items-center justify-center'>
              <p>Routing</p>
              <Info />
            </div>
            <p>CLOB</p>
          </div>
          <Separator className='bg-gray-800' />
          <div className='flex flex-row items-center justify-between'>
            <div className='flex flex-row gap-1 items-center justify-center'>
              <p>Slippage</p>
              <Info />
            </div>
            <p>0.5%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className='flex flex-row w-full items-center justify-between p-3'>
        <ConnectButton className={cn(text.hsb1(), "w-full p-6 rounded-xl h-16")} />
      </CardFooter>
    </Card>
  );
}
