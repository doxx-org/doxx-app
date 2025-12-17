"use client";

import { useMemo, useState } from "react";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TokenSelectorDialog } from "../swap/TokenSelectorDialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CreatePoolButton } from "./CreatePoolButton";
import { FeeTierSelection } from "./FeeTierSelection";
import { TokenSelectionRow } from "./TokenSelectionRow";

interface CreateCPMMPoolDialogProps {
  isOpen: boolean;
  splBalances: BalanceMapByMint | undefined;
  allTokenProfiles: TokenProfile[];
  onOpenChange: (open: boolean) => void;
}

enum SelectTokenType {
  TOKEN_A,
  TOKEN_B,
}

export const CreateCPMMPoolDialog = ({
  isOpen,
  splBalances,
  allTokenProfiles,
  onOpenChange,
}: CreateCPMMPoolDialogProps) => {
  const [tokenA, setTokenA] = useState<TokenProfile | null>(null);
  const [tokenB, setTokenB] = useState<TokenProfile | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState<SelectTokenType>(
    SelectTokenType.TOKEN_A,
  );
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);

  // Memoized calculations
  const lpTokenAmount = useMemo((): string => {
    if (
      !tokenA ||
      !tokenB ||
      !amountA ||
      !amountB ||
      amountA === "" ||
      amountB === ""
    ) {
      return "";
    }

    const numAmountA = parseFloat(amountA);
    const numAmountB = parseFloat(amountB);

    if (
      isNaN(numAmountA) ||
      isNaN(numAmountB) ||
      numAmountA <= 0 ||
      numAmountB <= 0
    ) {
      return "";
    }

    // For initial liquidity provision, LP tokens = sqrt(amount0 * amount1)
    // This is the Uniswap V2 constant product formula
    // Note: amounts are already in human-readable format, so we use them directly
    const lpAmount = Math.sqrt(numAmountA * numAmountB);

    // Format to 6 decimal places for display
    return lpAmount.toFixed(6);
  }, [tokenA, tokenB, amountA, amountB]);

  const tokenBalances = useMemo(() => {
    return {
      tokenA:
        tokenA && splBalances ? (splBalances[tokenA.address]?.amount ?? 0) : 0,
      tokenB:
        tokenB && splBalances ? (splBalances[tokenB.address]?.amount ?? 0) : 0,
    };
  }, [tokenA, tokenB, splBalances]);

  const usdValues = useMemo(() => {
    const getTokenPrice = (token: TokenProfile | null): number => {
      if (!token) return 0;
      // Placeholder prices - in a real app, these would come from a price API
      const mockPrices: Record<string, number> = {
        USDC: 1.0,
        sUSD: 1.0,
        LAYER: 0.05, // Example price
        sSOL: 180.0, // Example price
      };
      return mockPrices[token.address] ?? 0;
    };

    const calculateValue = (
      token: TokenProfile | null,
      amount: string,
    ): number => {
      if (!token || !amount || amount === "") return 0;
      const price = getTokenPrice(token);
      const numericAmount = parseFloat(amount);
      return isNaN(numericAmount) ? 0 : numericAmount * price;
    };

    const tokenAValue = calculateValue(tokenA, amountA);
    const tokenBValue = calculateValue(tokenB, amountB);

    return {
      tokenA: tokenAValue,
      tokenB: tokenBValue,
      total: tokenAValue + tokenBValue,
    };
  }, [tokenA, tokenB, amountA, amountB]);

  const handleSelectToken = (token: TokenProfile) => {
    if (selectedTokenType === SelectTokenType.TOKEN_A) {
      // If token B is the same as the new token A, clear it
      if (tokenB?.address.toLowerCase() === token.address.toLowerCase()) {
        setTokenB(null);
        setAmountB("");
      }
      setTokenA(token);
    } else if (selectedTokenType === SelectTokenType.TOKEN_B) {
      // If token A is the same as the new token B, clear it
      if (tokenA?.address.toLowerCase() === token.address.toLowerCase()) {
        setTokenA(null);
        setAmountA("");
      }
      setTokenB(token);
    }
    setIsTokenSelectorOpen(false);
  };

  const handleAmountChange = (
    value: string,
    setAmount: (value: string) => void,
  ) => {
    // Allow empty string, numbers, and decimal points
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleOpenTokenSelector = (tokenType: SelectTokenType) => {
    setSelectedTokenType(tokenType);
    setIsTokenSelectorOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[480px] w-[640px] !max-w-[576px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle>Create Pool</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col justify-between gap-5.5 p-3">
            {/* Token Selection Rows */}
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-1">
                <div className="h-full w-full rounded-tl-xl border border-gray-800 bg-gray-900 p-4 pt-5">
                  <TokenSelectionRow
                    token={tokenA}
                    amount={amountA}
                    placeholder="-0.00"
                    label="Token A"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_A)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountA)
                    }
                    balance={tokenBalances.tokenA}
                    usdValue={usdValues.tokenA}
                  />
                </div>

                <div className="h-full w-full rounded-tr-xl border border-gray-800 bg-gray-900 p-4 pt-5">
                  <TokenSelectionRow
                    token={tokenB}
                    amount={amountB}
                    placeholder="-0.00"
                    label="Token B"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_B)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountB)
                    }
                    balance={tokenBalances.tokenB}
                    usdValue={usdValues.tokenB}
                  />
                </div>
              </div>

              <div className="h-full w-full rounded-b-xl border border-gray-800 bg-gray-900 p-4 pt-5">
                {/* LP Token Info - Display Only */}
                <div className="flex w-full flex-col gap-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      LP Token
                    </span>
                    <span className={cn(text.b3(), "text-gray-300")}>
                      {tokenA && tokenB
                        ? `${tokenA.symbol} / ${tokenB.symbol}`
                        : "Select tokens"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      LP Amount
                    </span>
                    <span className={cn(text.sh1(), "text-gray-300")}>
                      {lpTokenAmount || "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      Total Value
                    </span>
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      $
                      {usdValues.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <FeeTierSelection
              selectedFeeIndex={selectedFeeIndex}
              onSelectFeeIndex={setSelectedFeeIndex}
            />
            <CreatePoolButton
              tokenA={tokenA}
              tokenB={tokenB}
              amountA={amountA}
              amountB={amountB}
              onSelectTokenA={setTokenA}
              onSelectTokenB={setTokenB}
              onAmountChangeA={setAmountA}
              onAmountChangeB={setAmountB}
              onOpenChange={onOpenChange}
              selectedFeeIndex={selectedFeeIndex}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Token Selector Dialog */}
      {isTokenSelectorOpen && (
        <TokenSelectorDialog
          isOpen={isTokenSelectorOpen}
          onOpenChange={setIsTokenSelectorOpen}
          tokenProfiles={allTokenProfiles}
          onSelectToken={handleSelectToken}
        />
      )}
    </>
  );
};
