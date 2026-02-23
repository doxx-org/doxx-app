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
import { useBestRouteV2 } from "@/lib/hooks/chain/prepare/useBestRouteV2";
import { useDoxxClmmProgram } from "@/lib/hooks/chain/useDoxxClmmProgram";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
import { useGetCLMMPools } from "@/lib/hooks/chain/useGetCLMMPools";
import { useGetCPMMPools } from "@/lib/hooks/chain/useGetCPMMPools";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useRaydium } from "@/lib/hooks/chain/useRaydium";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useAllPrices } from "@/lib/hooks/useAllPrices";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { text } from "@/lib/text";
import {
  cn,
  normalizeBN,
  parseAmountBN,
  parseDecimalsInput,
} from "@/lib/utils";
import { simplifyErrorMessage } from "@/lib/utils/errors/error";
import { SwapSuccessToast, SwapUnknownErrorToast } from "../toast/Swap";
import { CheckSignatureTimeoutToast } from "../toast/Toast";
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

  const doxxCpmmProgram = useDoxxCpmmProgram({
    provider,
  });
  const doxxClmmProgram = useDoxxClmmProgram({
    provider,
  });

  const slippageBps = useMemo(() => {
    return Number(slippage) * 100;
  }, [slippage]);

  const {
    data: cpmmPoolStates,
    isLoading: isLoadingCPMMPoolStates,
    refetch: refetchCPMMPoolStates,
    isRefetching: isRefetchingCPMMPoolStates,
  } = useGetCPMMPools(doxxCpmmProgram);

  const {
    data: clmmPoolStates,
    isLoading: isLoadingCLMMPoolStates,
    refetch: refetchCLMMPoolStates,
    isRefetching: isRefetchingCLMMPoolStates,
  } = useGetCLMMPools(doxxClmmProgram);

  const {
    data: allPools,
    // isLoading: isLoadingAllPools,
    // refetch: refetchAllPools,
  } = useGetAllPools();

  const { data: allPrices } = useAllPrices();

  const poolTokens = useMemo(() => {
    if (!allPools) return undefined;
    if (allPools.length === 0) return [];

    return allPools.map((p) => {
      return {
        mint0Address: p.lpToken.token1.address,
        mint0Decimals: p.lpToken.token1.decimals,
        mint1Address: p.lpToken.token2.address,
        mint1Decimals: p.lpToken.token2.decimals,
      };
    });
  }, [allPools]);

  // const prices:
  //   | { poolPrice: Record<string, number>; splPrice: Record<string, number> }
  //   | undefined = useMemo(() => {
  //   return allPools?.reduce(
  //     (acc, p) => {
  //       acc.splPrice[p.lpToken.token1.address.toLowerCase()] = p.priceToken1Usd;
  //       acc.splPrice[p.lpToken.token2.address.toLowerCase()] = p.priceToken2Usd;
  //       return acc;
  //     },
  //     {
  //       poolPrice: {},
  //       splPrice: {},
  //     } as {
  //       poolPrice: Record<string, number>;
  //       splPrice: Record<string, number>;
  //     },
  //   );
  // }, [allPools]);

  const {
    data: allTokenProfiles,
    isLoading: isLoadingAllTokenProfiles,
    error: errorAllTokenProfiles,
  } = useGetAllTokenInfos({ poolTokens });

  // get all spl balances
  const {
    data: splBalances,
    isLoading: isLoadingSplBalances,
    refetch: refetchSplBalances,
  } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    allTokenProfiles,
    true,
  );

  // Initialize Raydium SDK
  const { data: raydium } = useRaydium({ connection, wallet });

  // const {
  //   data: bestRoute,
  //   isLoading: isLoadingBestRoute,
  //   error: errorBestRoute,
  //   isRefetching: isRefetchingBestRoute,
  //   refetch: refetchBestRoute,
  // } = useBestRoute({
  //   connection,
  //   clmmProgramId: doxxClmmProgram?.programId,
  //   inputMint: new PublicKey(sellToken.address),
  //   outputMint: new PublicKey(buyToken.address),
  //   cpmmPools: cpmmPoolStates,
  //   clmmPools: clmmPoolStates,
  //   baseInput,
  //   isBaseExactIn,
  //   slippageBps,
  // });

  const {
    data: bestRouteV2,
    isLoading: isLoadingBestRouteV2,
    error: errorBestRouteV2,
    isRefetching: isRefetchingBestRouteV2,
    refetch: refetchBestRouteV2,
  } = useBestRouteV2({
    raydium,
    inputToken: sellToken,
    outputToken: buyToken,
    cpmmPools: cpmmPoolStates,
    clmmPools: clmmPoolStates,
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

  const isEmptyInput = useMemo(() => {
    return (
      (isBaseExactIn && sellAmount === "") ||
      (!isBaseExactIn && buyAmount === "")
    );
  }, [isBaseExactIn, sellAmount, buyAmount]);

  const isFetchingBestRoute = useMemo(() => {
    if (isEmptyInput) {
      return false;
    }

    return (
      isLoadingBestRouteV2 ||
      isTyping ||
      isRefetchingBestRouteV2 ||
      isRefetchingCPMMPoolStates ||
      isRefetchingCLMMPoolStates
    );
  }, [
    isLoadingBestRouteV2,
    isTyping,
    isEmptyInput,
    isRefetchingBestRouteV2,
    isRefetchingCPMMPoolStates,
    isRefetchingCLMMPoolStates,
  ]);

  const isActionable = useMemo(() => {
    return (
      !isLoadingAllTokenProfiles &&
      !errorAllTokenProfiles &&
      !isLoadingSplBalances &&
      !isLoadingCPMMPoolStates &&
      !isLoadingCLMMPoolStates
    );
  }, [
    isLoadingAllTokenProfiles,
    errorAllTokenProfiles,
    // isFetchingBestRoute,
    isLoadingSplBalances,
    isLoadingCPMMPoolStates,
    isLoadingCLMMPoolStates,
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
  const handleOpenTokenSelector = (selectTokenType: SelectTokenType) => {
    setSelectedTokenType(selectTokenType);
    setIsOpen(true);
  };

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
    refetchCPMMPoolStates();
    refetchCLMMPoolStates();
    refetchBestRouteV2();
    // refetchBestRoute();
    // }, [refetchCPMMPoolStates, refetchCLMMPoolStates, refetchBestRoute]);
  }, [refetchCPMMPoolStates, refetchCLMMPoolStates, refetchBestRouteV2]);

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
        refetchCPMMPoolStates();
        refetchCLMMPoolStates();
        setSellAmount("");
        setBuyAmount("");
      }, 2000);
    },
    [refetchSplBalances, refetchCPMMPoolStates, refetchCLMMPoolStates],
  );

  const handleError = (error: Error, txSignature?: string) => {
    if (error.message === "TransactionNotFoundOnChain" && txSignature) {
      toast.error(<CheckSignatureTimeoutToast signature={txSignature} />);
    } else {
      toast.error(
        simplifyErrorMessage(error, "Swap failed.\nPlease try again"),
      );
    }
    toast.error(simplifyErrorMessage(error, "Swap failed.\nPlease try again"));
  };

  const [tokenAValue, tokenBValue] = useMemo(() => {
    if (!allPrices) {
      return [undefined, undefined];
    }

    const tokenAPrice = allPrices[sellToken.address];
    const tokenBPrice = allPrices[buyToken.address];
    return [
      tokenAPrice !== undefined
        ? sellAmount !== ""
          ? tokenAPrice * parseFloat(sellAmount)
          : 0
        : undefined,
      tokenBPrice !== undefined
        ? buyAmount !== ""
          ? tokenBPrice * parseFloat(buyAmount)
          : 0
        : undefined,
    ];
  }, [allPrices, sellToken.address, sellAmount, buyToken.address, buyAmount]);

  useEffect(() => {
    if (!!errorBestRouteV2) {
      if (isBaseExactIn) {
        setBuyAmount("");
      } else {
        setSellAmount("");
      }
      return;
    }

    if (!bestRouteV2 && isFetchingBestRoute) {
      return;
    }

    if (!bestRouteV2) {
      // setBuyAmount("");
      // setSellAmount("");
      // setBaseInput("");
      return;
    }

    if (isBaseExactIn) {
      // normalize amount to human readable format
      const normalizedAmountOut = normalizeBN(
        bestRouteV2.swapState.token1Amount,
        bestRouteV2.swapState.token1Decimals,
        {
          minCap: parseAmountBN(
            "0.00001",
            bestRouteV2.swapState.token1Decimals,
          ),
        },
      );
      setBuyAmount(normalizedAmountOut);
    } else {
      // normalize amount to human readable format
      const normalizedAmountIn = normalizeBN(
        bestRouteV2.swapState.token0Amount,
        bestRouteV2.swapState.token0Decimals,
        {
          minCap: parseAmountBN(
            "0.00001",
            bestRouteV2.swapState.token0Decimals,
          ),
        },
      );
      setSellAmount(normalizedAmountIn);
    }
  }, [isBaseExactIn, bestRouteV2, isFetchingBestRoute, errorBestRouteV2]);

  // useEffect(() => {
  //   if (!!errorBestRoute) {
  //     if (isBaseExactIn) {
  //       setBuyAmount("");
  //     } else {
  //       setSellAmount("");
  //     }
  //     return;
  //   }

  //   if (!bestRoute && isFetchingBestRoute) {
  //     return;
  //   }

  //   if (!bestRoute) {
  //     // setBuyAmount("");
  //     // setSellAmount("");
  //     // setBaseInput("");
  //     return;
  //   }

  //   if (isBaseExactIn) {
  //     // normalize amount to human readable format
  //     const normalizedAmountOut = normalizeBN(
  //       bestRoute.swapState.token1Amount,
  //       bestRoute.swapState.token1Decimals,
  //       {
  //         minCap: parseAmountBN("0.00001", bestRoute.swapState.token1Decimals),
  //       },
  //     );
  //     setBuyAmount(normalizedAmountOut);
  //   } else {
  //     // normalize amount to human readable format
  //     console.log(
  //       "🚀 ~ bestRoute.swapState.token0Amount:",
  //       bestRoute.swapState.token0Amount.toString(),
  //     );
  //     const normalizedAmountIn = normalizeBN(
  //       bestRoute.swapState.token0Amount,
  //       bestRoute.swapState.token0Decimals,
  //       {
  //         minCap: parseAmountBN("0.00001", bestRoute.swapState.token0Decimals),
  //       },
  //     );
  //     console.log("🚀 ~ normalizedAmountIn:", normalizedAmountIn);
  //     setSellAmount(normalizedAmountIn);
  //   }
  // }, [isBaseExactIn, bestRoute, isFetchingBestRoute, errorBestRoute]);

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
            inputValue={tokenAValue}
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
            inputValue={tokenBValue}
          />
        </div>
        {/* details */}
        <div className={cn(text.sb3(), "flex flex-col gap-2 text-gray-600")}>
          <SwapInfo1
            bestRoute={bestRouteV2}
            isBaseExactIn={isBaseExactIn}
            buyToken={buyToken}
            sellToken={sellToken}
            isFetchingBestRoute={isFetchingBestRoute}
            onRefreshBestRoute={handleRefreshBestRoute}
          />
          <Separator className="bg-gray-800" />
          <SwapInfo2
            bestRoute={bestRouteV2}
            isFetchingBestRoute={isFetchingBestRoute}
            slippage={slippage}
          />
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-row items-center justify-between p-3 pt-0">
        <ConnectButtonWrapper
          className={cn(text.hsb1(), "mt-3 h-16 w-full rounded-xl p-6")}
        >
          <SwapButton
            errors={{
              errorAllTokenProfiles,
              errorBestRoute: errorBestRouteV2,
            }}
            cpmmProgram={doxxCpmmProgram}
            clmmProgram={doxxClmmProgram}
            connection={connection}
            bestRoute={bestRouteV2 ?? undefined}
            isActionable={isActionable}
            isQuotingRoute={isFetchingBestRoute}
            wallet={wallet}
            token0Balance={token0BalanceBN}
            token1Balance={token1BalanceBN}
            onSuccess={handleSuccess}
            onError={handleError}
            raydium={raydium}
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
