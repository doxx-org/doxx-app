import { useMemo } from "react";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint } from "@/lib/hooks/chain/types";
import { NumberFormatter } from "@/lib/utils";
import { TokenSelectionRow } from "../../TokenSelectionRow";

interface Formatter {
  input?: NumberFormatter;
  balance?: NumberFormatter;
  usd?: NumberFormatter;
}

interface DepositCLMMLPPanelProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  tokenAPriceUsd: number | undefined;
  tokenBPriceUsd: number | undefined;
  tokenAInput: string;
  tokenALoading: boolean;
  tokenBInput: string;
  tokenBLoading: boolean;
  walletBalances: BalanceMapByMint | undefined;
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
  tokenAPriceUsd,
  tokenBPriceUsd,
  tokenAInput,
  tokenALoading,
  tokenBInput,
  tokenBLoading,
  walletBalances,
  // formatter,
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

    const inputUsd =
      tokenAPriceUsd !== undefined
        ? Number(tokenAInput) * tokenAPriceUsd
        : undefined;
    const balance = walletBalances?.[tokenA.address]?.amount ?? 0;

    return {
      token: tokenA,
      balance: balance,
      inputAmount: tokenAInput,
      inputUsd: inputUsd,
    };
  }, [tokenA, walletBalances, tokenAPriceUsd, tokenAInput]);

  const tokenBInfo = useMemo(() => {
    if (!tokenB) {
      return {
        token: null,
        balance: 0,
        inputAmount: tokenBInput,
        inputUsd: 0,
      };
    }

    const inputUsd =
      tokenBPriceUsd !== undefined
        ? Number(tokenBInput) * tokenBPriceUsd
        : undefined;
    const balance = walletBalances?.[tokenB.address]?.amount ?? 0;

    return {
      token: tokenB,
      balance: balance,
      inputAmount: tokenBInput,
      inputUsd: inputUsd,
    };
  }, [tokenB, walletBalances, tokenBPriceUsd, tokenBInput]);

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
            isLoading={tokenALoading}
            disabled={tokenALoading}
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
            isLoading={tokenBLoading}
            disabled={tokenBLoading}
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
