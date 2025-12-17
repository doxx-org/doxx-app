import { useMemo } from "react";
import BN from "bn.js";
import { TokenProfile } from "@/lib/config/tokens";
import {
  BalanceMapByMint,
  PriceMap,
  SplBalance,
} from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { TokenSelectionRow } from "../TokenSelectionRow";

interface TokenInfo {
  token: TokenProfile;
  balance: BN;
  price: BN;
}

interface DepositPanelProps {
  tokenA: TokenProfile;
  tokenB: TokenProfile;
  walletBalances: BalanceMapByMint | undefined;
  priceMap: PriceMap | undefined;
  tokenAInput: string;
  tokenBInput: string;
  // lpToken: TokenInfo;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
}

export const DepositPanel = ({
  tokenA,
  tokenB,
  walletBalances,
  priceMap,
  tokenAInput,
  tokenBInput,
  onAmountAChange,
  onAmountBChange,
}: DepositPanelProps) => {
  const tokenAInfo = useMemo(() => {
    const inputUsd = Number(tokenAInput) * (priceMap?.[tokenA.address] ?? 0);
    const balance = walletBalances?.[tokenA.address]?.amount ?? 0;

    return {
      token: tokenA,
      balance: balance,
      inputAmount: tokenAInput,
      inputUsd: inputUsd,
    };
  }, [tokenA, walletBalances, priceMap, tokenAInput]);

  const tokenBInfo = useMemo(() => {
    const inputUsd = Number(tokenBInput) * (priceMap?.[tokenB.address] ?? 0);
    const balance = walletBalances?.[tokenB.address]?.amount ?? 0;

    return {
      token: tokenB,
      balance: balance,
      inputAmount: tokenBInput,
      inputUsd: inputUsd,
    };
  }, [tokenB, walletBalances, priceMap, tokenBInput]);

  const lpToken = useMemo(() => {
    return {
      inputAmount: 0,
      inputUsd: 0,
      balance: 0,
    };
  }, [tokenAInfo.balance, tokenBInfo.balance]);

  return (
    <div className="flex flex-col gap-4 px-4">
      <p className={cn(text.b4(), "text-white")}>Deposit Amount</p>
      <div className="flex flex-col gap-1">
        <div className="flex flex-row gap-1">
          <div className="h-full w-full rounded-tl-xl border border-gray-800 bg-gray-900 p-4 pt-5">
            <TokenSelectionRow
              token={tokenAInfo.token}
              amount={tokenAInfo.inputAmount}
              placeholder="-0.00"
              label={tokenAInfo.token.symbol || "Token A"}
              onTokenSelect={() => {}} // Disabled for deposit
              onAmountChange={onAmountAChange}
              balance={tokenAInfo.balance}
              usdValue={tokenAInfo.inputUsd}
              disableTokenSelect
            />
          </div>

          <div className="h-full w-full rounded-tr-xl border border-gray-800 bg-gray-900 p-4 pt-5">
            <TokenSelectionRow
              token={tokenBInfo.token}
              amount={tokenBInfo.inputAmount}
              placeholder="-0.00"
              label={tokenBInfo.token.symbol || "Token B"}
              onTokenSelect={() => {}} // Disabled for deposit
              onAmountChange={onAmountBChange}
              balance={tokenBInfo.balance}
              usdValue={tokenBInfo.inputUsd}
              disableTokenSelect
            />
          </div>
        </div>

        <div className="h-full w-full rounded-b-xl border border-gray-800 bg-gray-900 p-4 pt-5">
          <div className="relative flex items-center justify-center">
            <div className="bg-black-700 absolute -top-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-800">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 3V13M8 13L4 9M8 13L12 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green"
                />
              </svg>
            </div>
          </div>

          {/* LP Token Info - Display Only */}
          <div className="flex w-full flex-col gap-2 py-2 pt-6">
            <div className="flex items-center justify-between">
              <span className={cn(text.sb3(), "text-gray-400")}>
                {tokenA && tokenB
                  ? `${tokenA.symbol} / ${tokenB.symbol}`
                  : "Select / Select"}
              </span>
              <span className={cn(text.sh1(), "text-gray-300")}>
                +{lpToken.inputAmount || "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn(text.sb3(), "text-gray-500")}>
                Balance: 0
              </span>
              <span className={cn(text.sb3(), "text-gray-500")}>
                ${lpToken.inputUsd.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
