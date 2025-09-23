"use client";

import { useState } from "react";
import { TokenProfile, tokenProfiles } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TokenSelectorDialog } from "../swap/TokenSelectorDialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { TokenSelectionRow } from "./TokenSelectionRow";

interface CreatePoolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

enum SelectTokenType {
  TOKEN_A,
  TOKEN_B,
  LP_TOKEN,
}

export const CreatePoolDialog = ({
  isOpen,
  onOpenChange,
}: CreatePoolDialogProps) => {
  const [tokenA, setTokenA] = useState<TokenProfile | null>(null);
  const [tokenB, setTokenB] = useState<TokenProfile | null>(null);
  const [lpToken, setLpToken] = useState<TokenProfile | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState<SelectTokenType>(
    SelectTokenType.TOKEN_A,
  );
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const handleSelectToken = (token: TokenProfile) => {
    if (selectedTokenType === SelectTokenType.TOKEN_A) {
      // If token B is the same as the new token A, clear it
      if (tokenB?.symbol === token.symbol) {
        setTokenB(null);
        setAmountB("");
      }
      setTokenA(token);
    } else if (selectedTokenType === SelectTokenType.TOKEN_B) {
      // If token A is the same as the new token B, clear it
      if (tokenA?.symbol === token.symbol) {
        setTokenA(null);
        setAmountA("");
      }
      setTokenB(token);
    } else if (selectedTokenType === SelectTokenType.LP_TOKEN) {
      setLpToken(token);
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

  const handleDeposit = () => {
    // TODO: Implement pool creation logic
    console.log("Creating pool with:", {
      tokenA,
      tokenB,
      amountA,
      amountB,
    });
    onOpenChange(false);
  };

  const isDepositEnabled =
    tokenA &&
    tokenB &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[480px] w-[640px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle>Deposit</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col justify-between gap-1 p-6">
            {/* Token Selection Rows */}
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-1">
                <div className="h-full w-full rounded-tl-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenA}
                    amount={amountA}
                    placeholder="0.00"
                    label="Token A"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_A)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountA)
                    }
                  />
                </div>

                <div className="h-full w-full rounded-tr-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenB}
                    amount={amountB}
                    placeholder="0.00"
                    label="Token B"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_B)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountB)
                    }
                  />
                </div>
              </div>

              <div className="h-full w-full rounded-b-xl bg-gray-800 p-2">
                {/* LP Token Amount */}
                <TokenSelectionRow
                  token={lpToken}
                  amount={lpTokenAmount}
                  onAmountChange={(value) =>
                    handleAmountChange(value, setLpTokenAmount)
                  }
                  placeholder="0.00"
                  label="LP Token"
                  onTokenSelect={() =>
                    handleOpenTokenSelector(SelectTokenType.LP_TOKEN)
                  }
                />
              </div>
            </div>
            {/* Overview Section */}
            <div className="flex flex-col gap-2 pt-4">
              <h3 className={cn(text.sb2(), "text-gray-400")}>Overview</h3>
              <div className="h-px w-full bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(text.sb3(), "text-gray-400")}>
                    Share of pool
                  </span>
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-600">
                    <span className="text-xs text-gray-400">?</span>
                  </div>
                </div>
                <span className={cn(text.sb3(), "text-gray-300")}>0%</span>
              </div>

              <div className="h-px w-full bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(text.sb3(), "text-gray-400")}>
                    Earned fees
                  </span>
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-600">
                    <span className="text-xs text-gray-400">?</span>
                  </div>
                </div>
                <span className={cn(text.sb3(), "text-gray-300")}>0.03%</span>
              </div>
            </div>

            <div />
            {/* Deposit Button */}
            <Button
              className={cn(
                "h-12 w-full rounded-xl",
                isDepositEnabled
                  ? "bg-green hover:bg-green/90 text-black"
                  : "cursor-not-allowed bg-gray-700 text-gray-400",
              )}
              onClick={handleDeposit}
              disabled={!isDepositEnabled}
            >
              <span className={cn(text.hsb2())}>Deposit</span>
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Token Selector Dialog */}
      <TokenSelectorDialog
        isOpen={isTokenSelectorOpen}
        onOpenChange={setIsTokenSelectorOpen}
        tokenProfiles={tokenProfiles}
        onSelectToken={handleSelectToken}
      />
    </>
  );
};
