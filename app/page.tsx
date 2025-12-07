"use client";

import { useAtom } from "jotai";
import { ProSwapWidget, SwapWidget, TrendingTokens } from "@/components/swap";
import { TradingMode, tradingModeAtom } from "@/lib/utils/atomWithStorage";

export default function Home() {
  const [tradingMode] = useAtom(tradingModeAtom);

  if (tradingMode === TradingMode.PRO) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <ProSwapWidget />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center gap-16 p-8 sm:p-20">
      <div className="flex w-[468px] flex-col gap-3">
        <TrendingTokens />
        <SwapWidget />
      </div>
    </div>
  );
}
