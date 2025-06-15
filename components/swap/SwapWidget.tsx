"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwapInput } from "./SwapInput";
import Zap from "@/assets/icons/zap.svg";
import Gear from "@/assets/icons/gear.svg";
import { parseDecimalsInput } from "@/lib/utils";
import { symbol } from "motion/react-client";

export function SwapWidget() {
  const [sellCoin, setSellCoin] = useState("SOL");
  const [buyCoin, setBuyCoin] = useState("USDC");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const coinOptions = [
    {
      value: "SOL",
      symbol: "SOL",
      img: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422",
    },
    {
      value: "USDC",
      symbol: "USDC",
      img: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
    },
  ];

  return (
    <Card className='flex flex-col p-0 rounded-3xl'>
      <CardHeader className='flex flex-row items-center gap-2 flex-1 p-6 border-b border-gray-800'>
        <Zap />
        <CardTitle>Instant Swap</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4 p-3'>
        <div className='flex flex-row items-center w-full justify-end'>
          <Gear />
        </div>
        <div className='flex flex-col gap-1'>
          <SwapInput
            coin={sellCoin}
            coinOptions={coinOptions}
            amount={sellAmount}
            onAmountChange={(value) => setSellAmount(parseDecimalsInput(value))}
            onCoinChange={setSellCoin}
          />
          <SwapInput
            className='rounded-none rounded-b-xl'
            coin={buyCoin}
            coinOptions={coinOptions}
            amount={buyAmount}
            onAmountChange={(value) => setBuyAmount(parseDecimalsInput(value))}
            onCoinChange={setBuyCoin}
          />
        </div>
      </CardContent>
    </Card>
  );
}
