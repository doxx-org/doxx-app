"use client";

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
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
import { useBestRoutes } from "@/lib/hooks/chain/useBestRoutes";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { text } from "@/lib/text";
import {
  cn,
  normalizeBN,
  parseDecimalsInput,
  simplifyErrorMessage,
} from "@/lib/utils";
import { SwapSuccessToast, SwapUnknownErrorToast } from "../toast/Swap";
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
  // states
  const [sellToken, setSellToken] = useState(tokenProfiles[2]);
  const [buyToken, setBuyToken] = useState(tokenProfiles[3]);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState(
    SelectTokenType.SELL,
  );
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [isBaseExactIn, setIsBaseExactIn] = useState(true);
  const [isTypingLoading, setIsTypingLoading] = useState(false);

  // hooks
  const debouncedSellAmount = useDebounce(sellAmount, 1000);
  const debouncedBuyAmount = useDebounce(buyAmount, 1000);
  const { isOpen, setIsOpen } = useDialogState();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });

  // get all spl balances
  const { data: splBalances, refetch: refetchSplBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    tokenProfiles,
  );

  const doxxAmmProgram = useDoxxAmmProgram({
    provider,
  });

  const slippageBps = useMemo(() => {
    return Number(slippage) * 100;
  }, [slippage]);

  const { data: allPoolStates, refetch: refetchAllPoolStates } =
    useGetAllPools(doxxAmmProgram);

  const { data: bestRoute, isLoading: isLoadingBestRoute } = useBestRoutes({
    connection,
    inputMint: new PublicKey(sellToken.address),
    outputMint: new PublicKey(buyToken.address),
    pools: allPoolStates,
    baseInput,
    isBaseExactIn,
    slippageBps,
  });

  // memo token balances
  const [
    displayToken0Balance,
    displayToken1Balance,
    token0BalanceBN,
    token1BalanceBN,
  ] = useMemo(() => {
    const sellTokenBalance = splBalances?.[sellToken.symbol]?.amount;
    const buyTokenBalance = splBalances?.[buyToken.symbol]?.amount;

    const rawToken0Balance = splBalances?.[sellToken.symbol]?.rawAmount;
    const rawToken1Balance = splBalances?.[buyToken.symbol]?.rawAmount;

    const token0BalanceBN =
      rawToken0Balance !== undefined ? new BN(rawToken0Balance) : undefined;
    const token1BalanceBN =
      rawToken1Balance !== undefined ? new BN(rawToken1Balance) : undefined;

    return [
      sellTokenBalance,
      buyTokenBalance,
      token0BalanceBN,
      token1BalanceBN,
    ];
  }, [splBalances, sellToken.symbol, buyToken.symbol]);

  const isFetchingBestRoute = useMemo(() => {
    return isLoadingBestRoute || isTypingLoading;
  }, [isLoadingBestRoute, isTypingLoading]);

  // Callbacks
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

  const handleSellInputChange = useCallback((value: string) => {
    setSellAmount(parseDecimalsInput(value));
    setIsBaseExactIn(true);
    setIsTypingLoading(true);
  }, []);

  const handleBuyInputChange = useCallback((value: string) => {
    setBuyAmount(parseDecimalsInput(value));
    setIsBaseExactIn(false);
    setIsTypingLoading(true);
  }, []);

  // Handler functions for HALF and MAX buttons - memoized with useCallback
  const handleHalf = useCallback(() => {
    if (displayToken0Balance === undefined) {
      return;
    }
    const halfAmount = (displayToken0Balance / 2).toString();
    handleSellInputChange(halfAmount);
  }, [displayToken0Balance, handleSellInputChange]);

  const handleMax = useCallback(() => {
    if (displayToken0Balance === undefined) {
      return;
    }

    handleSellInputChange(displayToken0Balance.toString());
  }, [displayToken0Balance, handleSellInputChange]);

  const handleSuccess = useCallback(
    (txSignature: string | undefined) => {
      if (txSignature) {
        toast.success(<SwapSuccessToast txSignature={txSignature} />);
      } else {
        toast.error(<SwapUnknownErrorToast />);
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

  const handleError = (error: Error) => {
    toast.error(simplifyErrorMessage(error, "Swap failed"));
  };

  useEffect(() => {
    if (!bestRoute && isFetchingBestRoute) {
      return;
    }

    if (!bestRoute) {
      setBuyAmount("");
      setSellAmount("");
      setBaseInput("");
      return;
    }

    if (isBaseExactIn) {
      // normalize amount to human readable format
      const normalizedAmountOut = normalizeBN(
        bestRoute.token1Amount,
        bestRoute.token1Decimals,
      );
      setBuyAmount(normalizedAmountOut);
    } else {
      // normalize amount to human readable format
      const normalizedAmountIn = normalizeBN(
        bestRoute.token0Amount,
        bestRoute.token0Decimals,
      );
      setSellAmount(normalizedAmountIn);
    }
  }, [isBaseExactIn, bestRoute, isFetchingBestRoute]);

  useEffect(() => {
    if (isBaseExactIn) {
      setBaseInput(debouncedSellAmount);
    } else {
      setBaseInput(debouncedBuyAmount);
    }
    // stop the immediate typing loading once we hand off to debounced fetch
    setIsTypingLoading(false);
    // @eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSellAmount, debouncedBuyAmount]);

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
            onAmountChange={handleSellInputChange}
            onOpenTokenSelector={() => {
              handleOpenTokenSelector(SelectTokenType.SELL);
            }}
            tokenBalance={displayToken0Balance}
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
            onAmountChange={handleBuyInputChange}
            onOpenTokenSelector={() => {
              handleOpenTokenSelector(SelectTokenType.BUY);
            }}
            tokenBalance={displayToken1Balance}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>1 {sellToken.symbol}</p>
              <ArrowRight />
              <p>
                {isFetchingBestRoute
                  ? "…"
                  : bestRoute
                    ? normalizeBN(
                        bestRoute.amountOutPerOneTokenIn,
                        bestRoute.token1Decimals,
                      )
                    : "-"}{" "}
                {buyToken.symbol}
              </p>
            </div>
            <p className="tabular-nums">
              {isFetchingBestRoute
                ? "Calculating…"
                : bestRoute
                  ? `= ${normalizeBN(
                      bestRoute.token1Amount,
                      bestRoute.token1Decimals,
                    )} ${buyToken.symbol}`
                  : "-"}
            </p>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center justify-center gap-1">
              <p>Routing</p>
              <Info />
            </div>
            <p>Single-hop</p>
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
            bestRoute={bestRoute ?? undefined}
            isQuotingRoute={isFetchingBestRoute}
            wallet={wallet}
            token0Balance={token0BalanceBN}
            token1Balance={token1BalanceBN}
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
