"use client";

import { Dispatch, SetStateAction, useCallback, useState } from "react";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import ArrowRight from "@/assets/icons/arrow-right.svg";
import Gear from "@/assets/icons/gear.svg";
import Info from "@/assets/icons/info.svg";
import Zap from "@/assets/icons/zap.svg";
import { ConnectButton } from "@/components/ConnectBtn";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDialogState } from "@/hooks/useOpenDialog";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { parseDecimalsInput } from "@/lib/utils";
import { TokenProfile, tokenProfiles } from "@/utils/tokens";
import { Separator } from "../ui/separator";
import { SwapInput } from "./SwapInput";
import { TokenSelectorDialog } from "./TokenSelectorDialog";

enum SelectTokenType {
  SELL,
  BUY,
  NONE,
}

export function SwapWidget() {
  const [sellToken, setSellToken] = useState(tokenProfiles[0]);
  const [buyToken, setBuyToken] = useState(tokenProfiles[1]);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState(
    SelectTokenType.NONE,
  );
  const { isOpen, setIsOpen } = useDialogState();

  // callback when click switch token button
  const handleSelectSwitchToken = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
  }, [sellToken, buyToken]);

  // callback when select token inside token selector dialog
  const handleSelectToken = useCallback(
    (newToken: TokenProfile) => {
      // helper function to switch opposite token to current token if new token selecting is the same as the opposite one
      function switchOppositeTokenIfSame(
        currentToken: TokenProfile,
        oppositeToken: TokenProfile,
        setOppositeToken: Dispatch<SetStateAction<TokenProfile>>,
      ) {
        if (oppositeToken.symbol === newToken.symbol) {
          setOppositeToken(currentToken);
        }
      }

      if (selectedTokenType === SelectTokenType.SELL) {
        switchOppositeTokenIfSame(sellToken, buyToken, setBuyToken);
        setSellToken(newToken);
      } else if (selectedTokenType === SelectTokenType.BUY) {
        switchOppositeTokenIfSame(buyToken, sellToken, setSellToken);
        setBuyToken(newToken);
      }

      setSelectedTokenType(SelectTokenType.NONE);
      setIsOpen(false);
    },
    [selectedTokenType, sellToken, buyToken, setIsOpen],
  );

  // callback when open token selector dialog
  const handleOpenTokenSelector = (selectTokenType: SelectTokenType) => {
    setSelectedTokenType(selectTokenType);
    setIsOpen(true);
  };

  return (
    <Card className="flex flex-col rounded-2xl p-0">
      <CardHeader className="flex flex-1 flex-row items-center gap-2 border-b border-gray-800 p-6">
        <Zap />
        <CardTitle>Instant Swap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-3">
        <div className="flex w-full flex-row items-center justify-end">
          <Gear />
        </div>
        <div className="relative flex flex-col gap-1">
          <SwapInput
            title="Selling"
            token={sellToken}
            amount={sellAmount}
            onAmountChange={(value) => setSellAmount(parseDecimalsInput(value))}
            onOpenTokenSelector={() => {
              handleOpenTokenSelector(SelectTokenType.SELL);
            }}
          />
          <button
            type="button"
            className="bg-black-700 hover:bg-black-800 absolute top-1/2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-800 p-1 transition-colors"
            onClick={handleSelectSwitchToken}
            aria-label="Swap tokens"
          >
            <ArrowDown className="transition-transform hover:rotate-180" />
          </button>
          <SwapInput
            className="rounded-none rounded-b-xl"
            title="Buying"
            token={buyToken}
            amount={buyAmount}
            onAmountChange={(value) => setBuyAmount(parseDecimalsInput(value))}
            onOpenTokenSelector={() => {
              handleOpenTokenSelector(SelectTokenType.BUY);
            }}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>1 SOL</p>
              <ArrowRight />
              <p>1000.00 USDC</p>
            </div>
            <p>= 1000.00 USDC</p>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>Routing</p>
              <Info />
            </div>
            <p>CLOB</p>
          </div>
          <Separator className="bg-gray-800" />
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>Slippage</p>
              <Info />
            </div>
            <p>0.5%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-row items-center justify-between p-3">
        <ConnectButton
          className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
        />
      </CardFooter>
      {isOpen && (
        <TokenSelectorDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          tokenProfiles={tokenProfiles}
          onSelectToken={handleSelectToken}
        />
      )}
    </Card>
  );
}
