import { useEffect, useMemo } from "react";
import { TokenLabel } from "@/components/TokenLabel";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PriceMap } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { NumberFormatter, cn, formatNumber } from "@/lib/utils";
import { TokenSelectionRow } from "../TokenSelectionRow";

interface Formatter {
  input?: NumberFormatter;
  balance?: NumberFormatter;
  usd?: NumberFormatter;
}

interface DepositLPPanelProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  lpTokenMint: string | null;
  tokenAInput: string;
  tokenBInput: string;
  walletBalances: BalanceMapByMint | undefined;
  priceMap: PriceMap | undefined;
  formatter?: {
    tokenA?: Formatter;
    tokenB?: Formatter;
    lpToken?: Formatter;
  };
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  onAmountLPChange?: (value: string) => void;
  onTokenASelect?: () => void;
  onTokenBSelect?: () => void;
}

export const DepositLPPanel = ({
  tokenA,
  tokenB,
  lpTokenMint,
  tokenAInput,
  tokenBInput,
  walletBalances,
  priceMap,
  formatter,
  onAmountAChange,
  onAmountBChange,
  onAmountLPChange,
  onTokenASelect,
  onTokenBSelect,
}: DepositLPPanelProps) => {
  const tokenAInfo = useMemo(() => {
    if (!tokenA) {
      return {
        token: null,
        balance: 0,
        inputAmount: tokenAInput,
        inputUsd: 0,
      };
    }

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
    if (!tokenB) {
      return {
        token: null,
        balance: 0,
        inputAmount: tokenBInput,
        inputUsd: 0,
      };
    }

    const inputUsd = Number(tokenBInput) * (priceMap?.[tokenB.address] ?? 0);
    const balance = walletBalances?.[tokenB.address]?.amount ?? 0;

    return {
      token: tokenB,
      balance: balance,
      inputAmount: tokenBInput,
      inputUsd: inputUsd,
    };
  }, [tokenB, walletBalances, priceMap, tokenBInput]);

  // Memoized calculations
  const lpToken = useMemo(() => {
    let balance = 0;
    if (lpTokenMint && lpTokenMint !== "") {
      balance = walletBalances?.[lpTokenMint]?.amount ?? 0;
    }

    if (
      !tokenAInfo.token ||
      !tokenBInfo.token ||
      !tokenAInfo.inputAmount ||
      !tokenBInfo.inputAmount ||
      tokenAInfo.inputAmount === "" ||
      tokenBInfo.inputAmount === ""
    ) {
      return {
        amount: 0,
        value: 0,
        balance,
      };
    }

    const numAmountA = parseFloat(tokenAInfo.inputAmount);
    const numAmountB = parseFloat(tokenBInfo.inputAmount);

    if (
      isNaN(numAmountA) ||
      isNaN(numAmountB) ||
      numAmountA <= 0 ||
      numAmountB <= 0
    ) {
      return {
        amount: 0,
        value: 0,
        balance,
      };
    }

    // For initial liquidity provision, LP tokens = sqrt(amount0 * amount1)
    // This is the Uniswap V2 constant product formula
    // Note: amounts are already in human-readable format, so we use them directly
    const lpAmount = Math.sqrt(numAmountA * numAmountB);
    let lpUsd = 0;
    if (tokenAInfo.inputUsd !== 0 && tokenBInfo.inputUsd !== 0) {
      lpUsd = tokenAInfo.inputUsd + tokenBInfo.inputUsd;
    }

    // Format to 6 decimal places for display
    return {
      amount: lpAmount,
      value: lpUsd,
      balance,
    };
  }, [tokenAInfo, tokenBInfo, lpTokenMint, walletBalances]);

  useEffect(() => {
    onAmountLPChange?.(lpToken.amount.toString());
  }, [lpToken]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row gap-1">
        <div className="h-full w-[50%] rounded-tl-xl border border-gray-800 bg-gray-900 p-4 pt-5">
          <TokenSelectionRow
            token={tokenAInfo.token}
            amount={tokenAInfo.inputAmount}
            placeholder="-0.00"
            label={tokenAInfo.token?.symbol || "Token A"}
            onTokenSelect={
              onTokenASelect !== undefined ? onTokenASelect : () => {}
            }
            onAmountChange={onAmountAChange}
            balance={tokenAInfo.balance}
            usdValue={tokenAInfo.inputUsd}
            disableTokenSelect={onTokenASelect !== undefined ? false : true}
          />
        </div>

        <div className="h-full w-[50%] rounded-tr-xl border border-gray-800 bg-gray-900 p-4 pt-5">
          <TokenSelectionRow
            token={tokenBInfo.token}
            amount={tokenBInfo.inputAmount}
            placeholder="-0.00"
            label={tokenBInfo.token?.symbol || "Token B"}
            onTokenSelect={
              onTokenBSelect !== undefined ? onTokenBSelect : () => {}
            }
            onAmountChange={onAmountBChange}
            balance={tokenBInfo.balance}
            usdValue={tokenBInfo.inputUsd}
            disableTokenSelect={onTokenBSelect !== undefined ? false : true}
          />
        </div>
      </div>

      <div className="rounded-b-xl border border-gray-800 bg-gray-900 p-4 pt-5">
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
        <div className="flex flex-col gap-4">
          <TokenLabel
            token={null}
            label={
              !tokenA || !tokenB
                ? `Select / Select`
                : `${tokenA.symbol} / ${tokenB.symbol}`
            }
            disableTokenSelect={true}
          />
          <span
            className={cn(text.sh1(), "text-right leading-none text-gray-600")}
          >
            +
            {lpToken.amount !== 0
              ? formatNumber(lpToken.amount, {
                  decimals: 6,
                  ...formatter?.lpToken?.input,
                })
              : "0.00"}
          </span>
          <div
            className={cn(
              text.sb3(),
              "flex items-center justify-between leading-none",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-gray-700">Balance:</span>
              <span className="text-gray-600">
                {formatNumber(lpToken.balance, {
                  decimals: 6,
                  ...formatter?.lpToken?.balance,
                })}
              </span>
            </div>
            <span className="text-gray-600">
              $
              {formatNumber(lpToken.value, {
                decimals: 2,
                ...formatter?.lpToken?.usd,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
