"use client";

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import ArrowDown from "@/assets/icons/arrow-down.svg";
import ArrowRight from "@/assets/icons/arrow-right.svg";
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
import { DEFAULT_SLIPPAGE } from "@/lib/constants";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { copyToClipboard, text } from "@/lib/text";
import {
  cn,
  ellipseAddress,
  parseDecimalsInput,
  simplifyErrorMessage,
} from "@/lib/utils";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SwapButton } from "./SwapButton";
import { SwapInput } from "./SwapInput";
import { SwapSetting } from "./SwapSetting";
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
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);

  const { isOpen, setIsOpen } = useDialogState();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });

  const { data: splBalances, refetch: refetchSplBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    tokenProfiles,
  );

  const token0Balance = useMemo(() => {
    return splBalances?.[sellToken.symbol]?.amount;
  }, [splBalances, sellToken.symbol]);

  const token1Balance = useMemo(() => {
    return splBalances?.[buyToken.symbol]?.amount;
  }, [splBalances, buyToken.symbol]);

  const doxxAmmProgram = useDoxxAmmProgram({
    provider,
  });

  const { data: allPoolStates, refetch: refetchAllPoolStates } =
    useGetAllPools(doxxAmmProgram);

  // callback when click switch token button
  const handleSelectSwitchToken = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
  }, [sellToken, buyToken, sellAmount, buyAmount]);

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

  const handleSuccess = useCallback(
    (txSignature: string | undefined) => {
      if (txSignature) {
        toast.success(
          <div className="flex flex-col gap-0.5">
            <span>Swap successful</span>
            <div className="flex flex-row items-center gap-1">
              <span>Transaction signature: </span>
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {ellipseAddress(txSignature, 4)}
              </a>
              <CopyIcon
                className="h-4 w-4 cursor-pointer"
                onClick={() => copyToClipboard(txSignature)}
              />
            </div>
          </div>,
        );
      } else {
        toast.error(
          <div className="flex flex-col gap-0.5">
            <span>Swap failed with unknown reason.</span>
            <span>Please try again</span>
          </div>,
        );
      }

      // delay to refetch balances and pool states
      setTimeout(() => {
        refetchSplBalances();
        refetchAllPoolStates();
        setSellAmount("");
        setBuyAmount("");
      }, 2000);
    },
    [refetchSplBalances, refetchAllPoolStates],
  );

  const handleError = useCallback((error: Error) => {
    toast.error(simplifyErrorMessage(error, "Swap failed"));
  }, []);

  return (
    <Card className="flex flex-col rounded-2xl p-0">
      <CardHeader className="flex flex-1 flex-row items-center gap-2 border-b border-gray-800 p-6">
        <Zap />
        <CardTitle>Instant Swap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-3">
        <SwapSetting slippage={slippage} onSlippageChange={setSlippage} />
        <div className="relative flex flex-col gap-1">
          <SwapInput
            title="Selling"
            token={sellToken}
            amount={sellAmount}
            onAmountChange={(value) => setSellAmount(parseDecimalsInput(value))}
            onOpenTokenSelector={() => {
              handleOpenTokenSelector(SelectTokenType.SELL);
            }}
            tokenBalance={token0Balance}
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
            tokenBalance={token1Balance}
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
            <p>{slippage}%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-row items-center justify-between p-3">
        <ConnectButtonWrapper
          className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
        >
          <SwapButton
            program={doxxAmmProgram}
            token0={sellToken}
            token1={buyToken}
            amount0={sellAmount}
            amount1={buyAmount}
            poolState={allPoolStates?.[0].poolState}
            wallet={wallet}
            onSuccess={handleSuccess}
            onError={handleError}
          />
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
