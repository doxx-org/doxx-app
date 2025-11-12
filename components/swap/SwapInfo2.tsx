import Info from "@/assets/icons/info.svg";
import { IUseBestRouteResponse } from "@/lib/hooks/chain/useBestRoute";
import { ellipseAddress, normalizeBPSString } from "@/lib/utils";
import { Link } from "../Link";
import { Underlined } from "../Underlined";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface SwapInfo2Props {
  bestRoute: IUseBestRouteResponse | null | undefined;
  isFetchingBestRoute: boolean;
  slippage: string;
}

export function SwapInfo2({
  bestRoute,
  isFetchingBestRoute,
  slippage,
}: SwapInfo2Props) {
  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center justify-center gap-1">
          <p>Routing</p>
          <Tooltip>
            <TooltipTrigger>
              <Info />
            </TooltipTrigger>
            <TooltipContent>
              The best route to get the best price for your trade
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-row items-center justify-center gap-1">
          {isFetchingBestRoute ? (
            <Skeleton />
          ) : (
            <div>
              {bestRoute ? (
                <Tooltip>
                  <TooltipTrigger>
                    <Underlined>CPMM</Underlined>
                  </TooltipTrigger>
                  <TooltipContent className="flex flex-col gap-1">
                    <div>
                      Fee:{" "}
                      {normalizeBPSString(
                        bestRoute.pool.ammConfig.tradeFeeRate.toString(),
                      )}
                      %
                    </div>
                    <div>
                      AMM ID:{" "}
                      <Link
                        href={`https://solscan.io/account/${bestRoute.pool.poolState.ammConfig.toString()}`}
                      >
                        {ellipseAddress(
                          bestRoute.pool.poolState.ammConfig.toString(),
                        )}
                      </Link>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                "-"
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center justify-center gap-1">
          <p>Slippage</p>
          <Tooltip>
            <TooltipTrigger>
              <Info />
            </TooltipTrigger>
            <TooltipContent>
              If the price slips any further more than the percentage set, your
              transaction will revert.
            </TooltipContent>
          </Tooltip>
        </div>
        <p>{slippage}%</p>
      </div>
    </>
  );
}
