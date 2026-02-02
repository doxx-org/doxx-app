import { useCallback, useMemo, useState } from "react";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import ArrowRight from "@/assets/icons/arrow-right.svg";
import Info from "@/assets/icons/info.svg";
import { TokenProfile } from "@/lib/config/tokens";
import { IUseBestRouteResponse } from "@/lib/hooks/chain/useBestRoute";
import { cn, normalizeBN } from "@/lib/utils";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface SwapInfo1Props {
  bestRoute: IUseBestRouteResponse | null | undefined;
  isBaseExactIn: boolean;
  buyToken: TokenProfile;
  sellToken: TokenProfile;
  isFetchingBestRoute: boolean;
  onRefreshBestRoute: () => void;
}

export function SwapInfo1({
  bestRoute,
  isBaseExactIn,
  buyToken,
  sellToken,
  isFetchingBestRoute,
  onRefreshBestRoute,
}: SwapInfo1Props) {
  const [isFlipped, setIsFlipped] = useState(false);

  const amountInfo = useMemo(() => {
    if (isFlipped) {
      return {
        baseToken: buyToken,
        quoteToken: sellToken,
        amountPerOneToken: bestRoute
          ? normalizeBN(
              bestRoute.swapState.amountInPerOneTokenOut,
              sellToken.decimals,
              {
                displayDecimals: buyToken.displayDecimals,
              },
            )
          : "-",
      };
    } else {
      return {
        baseToken: sellToken,
        quoteToken: buyToken,
        amountPerOneToken: bestRoute
          ? normalizeBN(
              bestRoute.swapState.amountOutPerOneTokenIn,
              sellToken.decimals,
              {
                displayDecimals: sellToken.displayDecimals,
              },
            )
          : "-",
      };
    }
  }, [isFlipped, bestRoute, buyToken, sellToken]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center justify-center gap-1">
          <p>1 {amountInfo.baseToken.symbol}</p>
          <ArrowRight />

          {isFetchingBestRoute ? (
            <Skeleton />
          ) : (
            <p
              className={cn(
                amountInfo.amountPerOneToken === "-" ? "" : "text-gray-50",
              )}
            >
              {amountInfo.amountPerOneToken} {amountInfo.quoteToken.symbol}
            </p>
          )}
          <Button
            variant="ghost"
            className={cn("h-full p-0")}
            onClick={handleFlip}
          >
            <ArrowLeftRight
              className={cn(
                "h-4 w-4 transition-all duration-200",
                isFlipped ? "scale-x-[-1] transform" : "",
              )}
            />
          </Button>
        </div>
        <Button
          variant="ghost"
          disabled={isFetchingBestRoute || !bestRoute}
          className={cn(
            isFetchingBestRoute ? "animate-spin text-gray-400" : "",
            "h-full p-0",
          )}
          onClick={
            isFetchingBestRoute || !bestRoute ? undefined : onRefreshBestRoute
          }
        >
          <RefreshCw className="h-4 w-4 transition-all duration-200 group-hover:drop-shadow-gray-50" />
        </Button>
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center justify-center gap-1">
          <p>{isBaseExactIn ? "Minimum Received" : "Maximum Spent"}</p>
          <Tooltip>
            <TooltipTrigger>
              <Info />
            </TooltipTrigger>
            <TooltipContent>
              {isBaseExactIn
                ? "The least amount of tokens you'll get, governed by your slippage tolerance."
                : "The most tokens you'll spend, governed by your slippage tolerance."}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-1">
          {"="}
          {isFetchingBestRoute ? (
            <Skeleton />
          ) : (
            <p>
              {bestRoute
                ? `${normalizeBN(
                    bestRoute.swapState.minMaxAmount,
                    isBaseExactIn ? buyToken.decimals : sellToken.decimals,
                    {
                    displayDecimals: isBaseExactIn
                      ? buyToken.displayDecimals
                      : sellToken.displayDecimals,
                    },
                  )} ${isBaseExactIn ? buyToken.symbol : sellToken.symbol}`
                : "-"}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center justify-center gap-1">
          <p>Price Impact</p>
          <Tooltip>
            <TooltipTrigger>
              <Info />
            </TooltipTrigger>
            <TooltipContent>
              The difference between the current market price and estimated
              price due to trade size
            </TooltipContent>
          </Tooltip>
        </div>
        {isFetchingBestRoute ? (
          <Skeleton />
        ) : (
          <p>
            {bestRoute
              ? "N/A"
              : // ? `${normalizeBN(bestRoute.swapState.priceImpact, 4)}%`
                "-"}
          </p>
        )}
      </div>
    </>
  );
}
