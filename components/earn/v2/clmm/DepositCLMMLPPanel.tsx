import { useEffect, useMemo } from "react";
import { TokenLabel } from "@/components/TokenLabel";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PriceMap } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { NumberFormatter, cn, formatNumber } from "@/lib/utils";
import { TokenSelectionRow } from "../../TokenSelectionRow";

interface Formatter {
  input?: NumberFormatter;
  balance?: NumberFormatter;
  usd?: NumberFormatter;
}

interface DepositCLMMLPPanelProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
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
  onTokenASelect?: () => void;
  onTokenBSelect?: () => void;
}

export const DepositCLMMLPPanel = ({
  tokenA,
  tokenB,
  tokenAInput,
  tokenBInput,
  walletBalances,
  priceMap,
  formatter,
  onAmountAChange,
  onAmountBChange,
  onTokenASelect,
  onTokenBSelect,
}: DepositCLMMLPPanelProps) => {
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <div className="w-full rounded-t-xl border border-gray-800 bg-gray-900 p-4">
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
            className="gap-2"
          />
        </div>

        <div className="w-full rounded-b-xl border border-gray-800 bg-gray-900 p-4">
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
            className="gap-2"
          />
        </div>
      </div>
    </div>
  );
};
