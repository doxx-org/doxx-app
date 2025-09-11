"use client";

import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import ArrowRight from "@/assets/icons/arrow-right.svg";
import Gear from "@/assets/icons/gear.svg";
import Info from "@/assets/icons/info.svg";
import Zap from "@/assets/icons/zap.svg";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectButtonWrapper } from "@/components/wallet/ConnectButtonWrapper";
import { TokenProfile, tokenProfiles } from "@/lib/config/tokens";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { parseDecimalsInput } from "@/lib/utils";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SwapButton } from "./SwapButton";
import { SwapInput } from "./SwapInput";
import { TokenSelectorDialog } from "./TokenSelectorDialog";

enum SelectTokenType {
  SELL,
  BUY,
}

const SellActionButtons = ({
  onHalf,
  onMax,
}: {
  onHalf: () => void;
  onMax: () => void;
}) => {
  return (
    <>
      <Button
        variant="adjust"
        className="h-fit px-3 py-1 text-gray-600"
        onClick={onHalf}
      >
        HALF
      </Button>
      <Button
        variant="adjust"
        className="h-fit px-3 py-1 text-gray-600"
        onClick={onMax}
      >
        MAX
      </Button>
    </>
  );
};

export function SwapWidget() {
  const [sellToken, setSellToken] = useState(tokenProfiles[0]);
  const [buyToken, setBuyToken] = useState(tokenProfiles[1]);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState(
    SelectTokenType.SELL,
  );
  const { isOpen, setIsOpen } = useDialogState();
  const { connection } = useConnection();
  const { wallet } = useWallet();

  // callback when click switch token button
  const handleSelectSwitchToken = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
  }, [sellToken, buyToken, sellAmount, buyAmount]);

  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.adapter.publicKey ?? undefined,
    tokenProfiles,
  );

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
      } else {
        switchOppositeTokenIfSame(buyToken, sellToken, setSellToken);
        setBuyToken(newToken);
      }

      setSelectedTokenType(SelectTokenType.SELL);
      setIsOpen(false);
    },
    [selectedTokenType, sellToken, buyToken, setIsOpen],
  );

  // callback when open token selector dialog
  const handleOpenTokenSelector = (selectTokenType: SelectTokenType) => {
    setSelectedTokenType(selectTokenType);
    setIsOpen(true);
  };

  // Handler functions for HALF and MAX buttons - memoized with useCallback
  const handleHalf = useCallback(() => {
    const sellTokenBalance = splBalances?.[sellToken.symbol]?.amount;
    if (sellTokenBalance) {
      const halfAmount = (sellTokenBalance / 2).toString();
      setSellAmount(parseDecimalsInput(halfAmount));
    }
  }, [sellToken.symbol, splBalances]);

  const handleMax = useCallback(() => {
    const sellTokenBalance = splBalances?.[sellToken.symbol]?.amount;
    if (sellTokenBalance) {
      setSellAmount(parseDecimalsInput(sellTokenBalance.toString()));
    }
  }, [sellToken.symbol, splBalances]);

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
            tokenBalance={splBalances?.[sellToken.symbol]?.amount}
            actionButtons={
              <SellActionButtons onHalf={handleHalf} onMax={handleMax} />
            }
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
            tokenBalance={splBalances?.[buyToken.symbol]?.amount}
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
        <ConnectButtonWrapper
          className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
        >
          <SwapButton />
        </ConnectButtonWrapper>
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
