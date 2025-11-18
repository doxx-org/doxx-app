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
import Zap from "@/assets/icons/zap.svg";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectButtonWrapper } from "@/components/wallet/ConnectButtonWrapper";
import { TokenProfile, defaultSwapTokens } from "@/lib/config/tokens";
import { DEFAULT_SLIPPAGE } from "@/lib/constants";
import { useBestRoute } from "@/lib/hooks/chain/useBestRoute";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { text } from "@/lib/text";
import { cn, normalizeBN, parseDecimalsInput } from "@/lib/utils";
import { simplifyErrorMessage } from "@/lib/utils/errors/error";
import { SwapSuccessToast, SwapUnknownErrorToast } from "../toast/Swap";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SwapButton } from "./SwapButton";
import { SwapInfo1 } from "./SwapInfo1";
import { SwapInfo2 } from "./SwapInfo2";
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
  const [sellToken, setSellToken] = useState(defaultSwapTokens[0]);
  const [buyToken, setBuyToken] = useState(defaultSwapTokens[1]);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState(
    SelectTokenType.SELL,
  );
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [isBaseExactIn, setIsBaseExactIn] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  // hooks
  const debouncedSellAmount = useDebounce(sellAmount, 1000);
  const debouncedBuyAmount = useDebounce(buyAmount, 1000);
  const { isOpen, setIsOpen } = useDialogState();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });

  const doxxAmmProgram = useDoxxAmmProgram({
    provider,
  });

  const slippageBps = useMemo(() => {
    return Number(slippage) * 100;
  }, [slippage]);

  const {
    data: allPoolStates,
    isLoading: isLoadingAllPoolStates,
    refetch: refetchAllPoolStates,
    isRefetching: isRefetchingAllPoolStates,
  } = useGetAllPools(doxxAmmProgram);

  const {
    data: allTokenProfiles,
    isLoading: isLoadingAllTokenProfiles,
    error: errorAllTokenProfiles,
  } = useGetAllTokenInfos(allPoolStates);

  // get all spl balances
  const {
    data: splBalances,
    isLoading: isLoadingSplBalances,
    refetch: refetchSplBalances,
  } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    allTokenProfiles,
  );

  const {
    data: bestRoute,
    isLoading: isLoadingBestRoute,
    error: errorBestRoute,
    isRefetching: isRefetchingBestRoute,
    refetch: refetchBestRoute,
  } = useBestRoute({
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
    const sellTokenBalance = splBalances?.[sellToken.address]?.amount;
    const buyTokenBalance = splBalances?.[buyToken.address]?.amount;

    const rawToken0Balance = splBalances?.[sellToken.address]?.rawAmount;
    const rawToken1Balance = splBalances?.[buyToken.address]?.rawAmount;

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
  }, [splBalances, sellToken.address, buyToken.address]);

  const isFetchingBestRoute = useMemo(() => {
    const isEmptyInput =
      (isBaseExactIn && sellAmount === "") ||
      (!isBaseExactIn && buyAmount === "");
    if (isEmptyInput) {
      return false;
    }

    return (
      isLoadingBestRoute ||
      isTyping ||
      isRefetchingBestRoute ||
      isRefetchingAllPoolStates // TODO: consider how to ignore this because it fetches all pool states
    );
  }, [
    isLoadingBestRoute,
    isTyping,
    isBaseExactIn,
    sellAmount,
    buyAmount,
    isRefetchingBestRoute,
    isRefetchingAllPoolStates,
  ]);

  const isActionable = useMemo(() => {
    return (
      !isLoadingAllTokenProfiles &&
      !errorAllTokenProfiles &&
      !isLoadingSplBalances &&
      !isLoadingAllPoolStates
    );
  }, [
    isLoadingAllTokenProfiles,
    errorAllTokenProfiles,
    // isFetchingBestRoute,
    isLoadingSplBalances,
    isLoadingAllPoolStates,
  ]);

  // Callbacks
  // callback when click switch token button
  const handleSelectSwitchToken = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setIsBaseExactIn(!isBaseExactIn);
  }, [sellToken, buyToken, sellAmount, buyAmount, isBaseExactIn]);

  // callback when select token inside token selector dialog
  const handleSelectToken = useCallback(
    (newToken: TokenProfile) => {
      // helper function to switch opposite token to current token if new token selecting is the same as the opposite one
      function switchOppositeTokenIfSame(
        currentToken: TokenProfile,
        oppositeToken: TokenProfile,
        setOppositeToken: Dispatch<SetStateAction<TokenProfile>>,
      ) {
        if (
          oppositeToken.address.toLowerCase() === newToken.address.toLowerCase()
        ) {
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
  const handleOpenTokenSelector = isActionable
    ? (selectTokenType: SelectTokenType) => {
        setSelectedTokenType(selectTokenType);
        setIsOpen(true);
      }
    : undefined;

  const handleSellInputChange = useCallback((value: string) => {
    setSellAmount(parseDecimalsInput(value));
    setIsBaseExactIn(true);
    setIsTyping(true);
  }, []);

  const handleBuyInputChange = useCallback((value: string) => {
    setBuyAmount(parseDecimalsInput(value));
    setIsBaseExactIn(false);
    setIsTyping(true);
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

  const handleRefreshBestRoute = useCallback(() => {
    refetchAllPoolStates();
    refetchBestRoute();
  }, [refetchAllPoolStates, refetchBestRoute]);

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
    if (!!errorBestRoute) {
      if (isBaseExactIn) {
        setBuyAmount("");
      } else {
        setSellAmount("");
      }
      return;
    }

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
        bestRoute.swapState.token1Amount,
        bestRoute.swapState.token1Decimals,
      );
      setBuyAmount(normalizedAmountOut);
    } else {
      // normalize amount to human readable format
      const normalizedAmountIn = normalizeBN(
        bestRoute.swapState.token0Amount,
        bestRoute.swapState.token0Decimals,
      );
      setSellAmount(normalizedAmountIn);
    }
  }, [isBaseExactIn, bestRoute, isFetchingBestRoute, errorBestRoute]);

  useEffect(() => {
    if (isBaseExactIn) {
      setBaseInput(debouncedSellAmount);
    } else {
      setBaseInput(debouncedBuyAmount);
    }
    // stop the immediate typing loading once we hand off to debounced fetch
    setIsTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSellAmount, debouncedBuyAmount]);

  useEffect(() => {
    if (
      (isBaseExactIn && sellAmount === "") ||
      (!isBaseExactIn && buyAmount === "")
    ) {
      setBaseInput("");
    }
  }, [isBaseExactIn, buyAmount, sellAmount]);

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
            onOpenTokenSelector={
              handleOpenTokenSelector
                ? () => {
                    handleOpenTokenSelector(SelectTokenType.SELL);
                  }
                : undefined
            }
            tokenBalance={displayToken0Balance}
            actionButtons={
              <SellActionButtons onHalf={handleHalf} onMax={handleMax} />
            }
            isActionable={isActionable}
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
            onOpenTokenSelector={
              handleOpenTokenSelector
                ? () => {
                    handleOpenTokenSelector(SelectTokenType.BUY);
                  }
                : undefined
            }
            tokenBalance={displayToken1Balance}
            isActionable={isActionable}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <SwapInfo1
            bestRoute={bestRoute}
            isBaseExactIn={isBaseExactIn}
            buyToken={buyToken}
            sellToken={sellToken}
            isFetchingBestRoute={isFetchingBestRoute}
            onRefreshBestRoute={handleRefreshBestRoute}
          />
          <Separator className="bg-gray-800" />
          <SwapInfo2
            bestRoute={bestRoute}
            isFetchingBestRoute={isFetchingBestRoute}
            slippage={slippage}
          />
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-row items-center justify-between p-3">
        <ConnectButtonWrapper
          className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
        >
          <SwapButton
            errors={{
              errorAllTokenProfiles,
              errorBestRoute,
            }}
            program={doxxAmmProgram}
            bestRoute={bestRoute ?? undefined}
            isActionable={isActionable}
            isQuotingRoute={isFetchingBestRoute}
            wallet={wallet}
            token0Balance={token0BalanceBN}
            token1Balance={token1BalanceBN}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </ConnectButtonWrapper>
      </CardFooter>
      {isOpen && allTokenProfiles && !isLoadingAllTokenProfiles && (
        <TokenSelectorDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          tokenProfiles={allTokenProfiles}
          onSelectToken={handleSelectToken}
        />
      )}
    </Card>
  );
}
