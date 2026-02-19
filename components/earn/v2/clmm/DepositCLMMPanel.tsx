import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PriceMap } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { DepositCLMMLPPanel } from "./DepositCLMMLPPanel";

interface DepositCLMMPanelProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  walletBalances: BalanceMapByMint | undefined;
  tokenAPriceUsd: number | undefined;
  tokenBPriceUsd: number | undefined;
  tokenAInput: string;
  tokenALoading: boolean;
  tokenBInput: string;
  tokenBLoading: boolean;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  className?: string;
  ratioClassName?: string;
}

export const DepositCLMMPanel = ({
  tokenA,
  tokenB,
  walletBalances,
  tokenAPriceUsd,
  tokenBPriceUsd,
  tokenAInput,
  tokenALoading,
  tokenBInput,
  tokenBLoading,
  onAmountAChange,
  onAmountBChange,
  className,
  ratioClassName,
}: DepositCLMMPanelProps) => {
  // const [depositRatio, setDepositRatio] = useMemo(() => {
  //   if (!tokenAInput || !tokenBInput || tokenAInput === "" || tokenBInput === "") {
  //     return ["-", "-"];
  //   }

  //   const totalAmount = parseFloat(tokenAInput) + parseFloat(tokenBInput);
  //   const ratioA = parseFloat(tokenAInput) / totalAmount;
  //   const ratioB = parseFloat(tokenBInput) / totalAmount;
  //   return [50, 50];
  // }, [tokenAInput, tokenBInput]);

  return (
    <div className={cn("flex flex-col gap-4 px-4", className)}>
      <p className={cn(text.b4(), "leading-none text-white")}>Deposit Amount</p>
      {/* LP Token depositing panel */}
      <DepositCLMMLPPanel
        tokenA={tokenA}
        tokenB={tokenB}
        walletBalances={walletBalances}
        tokenAPriceUsd={tokenAPriceUsd}
        tokenBPriceUsd={tokenBPriceUsd}
        tokenAInput={tokenAInput}
        tokenALoading={tokenALoading}
        tokenBInput={tokenBInput}
        tokenBLoading={tokenBLoading}
        onAmountAChange={onAmountAChange}
        onAmountBChange={onAmountBChange}
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
