import { useMemo } from "react";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PriceMap } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { DepositLPPanel } from "./DepositLPPanel";

interface DepositPanelProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  lpTokenMint: string | null;
  walletBalances: BalanceMapByMint | undefined;
  priceMap: PriceMap | undefined;
  tokenAInput: string;
  tokenBInput: string;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  onAmountLPChange: (value: string) => void;
  className?: string;
  ratioClassName?: string;
}

export const DepositPanel = ({
  tokenA,
  tokenB,
  lpTokenMint,
  walletBalances,
  priceMap,
  tokenAInput,
  tokenBInput,
  onAmountAChange,
  onAmountBChange,
  onAmountLPChange,
  className,
  ratioClassName,
}: DepositPanelProps) => {
  return (
    <div className={cn("flex flex-col gap-4 px-4", className)}>
      <p className={cn(text.b4(), "leading-none text-white")}>Deposit Amount</p>
      {/* LP Token depositing panel */}
      <DepositLPPanel
        tokenA={tokenA}
        tokenB={tokenB}
        lpTokenMint={lpTokenMint}
        walletBalances={walletBalances}
        priceMap={priceMap}
        tokenAInput={tokenAInput}
        tokenBInput={tokenBInput}
        onAmountAChange={onAmountAChange}
        onAmountBChange={onAmountBChange}
        onAmountLPChange={onAmountLPChange}
      />
      {/* Deposit ratio panel */}
      <div
        className={cn(
          text.sb3(),
          "flex w-full justify-between leading-none",
          ratioClassName,
        )}
      >
        <p className="py-1.75 text-gray-500">Deposit Ratio</p>
        <div className="flex gap-1">
          <button className="flex h-full items-center gap-1 rounded-full bg-gray-900 px-3 hover:cursor-pointer hover:bg-gray-800">
            <div className="h-3.5 w-3.5 rounded-full bg-gray-700" />
            <span className="text-gray-200">50%</span>
          </button>
          <button className="flex h-full items-center gap-1 rounded-full bg-gray-900 px-3 hover:cursor-pointer hover:bg-gray-800">
            <div className="h-3.5 w-3.5 rounded-full bg-gray-700" />
            <span className="text-gray-200">50%</span>
          </button>
        </div>
      </div>
    </div>
  );
};
