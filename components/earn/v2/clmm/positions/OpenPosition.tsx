import { useMemo } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { TokenPriceDisplay } from "@/components/TokenPriceDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn, formatNumber, normalizeBPSString } from "@/lib/utils";
import { Pool } from "../../types";
import { PositionAmount } from "./PositionAmount";
import { PositionRangeLabel } from "./PositionRangeLabel";

interface OpenPositionProps {
  position: IPositionWithValue;
  selectedPool: Pool;
  onBack: () => void;
}

export const OpenPosition = ({
  position,
  selectedPool,
  onBack,
}: OpenPositionProps) => {
  const {
    lpToken: { token1, token2 },
    fee,
  } = selectedPool;

  const stakedLp = useMemo(() => {
    return position.amount0 + position.amount1;
  }, [position.amount0, position.amount1]);

  return (
    <div className="flex flex-col gap-5 border-b border-gray-800 px-4 py-5">
      <div
        className={cn(
          "flex cursor-pointer items-center gap-2 text-gray-400",
          text.sb2(),
        )}
        onClick={onBack}
      >
        <ArrowLeftIcon className="size-4" />
        {"Back"}
      </div>
      <div className="flex flex-col gap-3">
        {/* Header: pool info + range status */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4.5">
            <div className="flex shrink-0 items-center">
              <Avatar className="size-8.5">
                <AvatarImage src={token1.image} alt={token1.symbol} />
                <AvatarFallback>{token1.symbol}</AvatarFallback>
              </Avatar>
              <Avatar className="-ml-2 size-8.5">
                <AvatarImage src={token2.image} alt={token2.symbol} />
                <AvatarFallback>{token2.symbol}</AvatarFallback>
              </Avatar>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <p className={cn(text.hsb2(), "truncate text-gray-200")}>
                  {token1.symbol}/{token2.symbol}
                </p>
                <span
                  className={cn(
                    text.sb4(),
                    "text-green rounded-full bg-gray-900 px-3 py-1.5",
                  )}
                >
                  {selectedPool.poolType.toUpperCase()}
                </span>
                <p className={cn(text.sb3(), "text-green")}>
                  {normalizeBPSString(fee.toString())}%
                </p>
              </div>
            </div>
          </div>

          <PositionRangeLabel
            position={position}
            currentTick={position.pool.tickCurrent}
            tickLower={position.account.tickLowerIndex}
            tickUpper={position.account.tickUpperIndex}
            isLoading={false}
          />
        </div>

        {/* Position Amount */}
        <PositionAmount
          position={position}
          selectedPool={selectedPool}
          isLoading={false}
        />

        {/* Position summary card */}
        <div className={cn(text.sb3(), "flex flex-col gap-2")}>
          <div className="flex items-center justify-between">
            <p className="text-gray-500">Staked LP:</p>
            <p className="font-medium text-gray-50">{formatNumber(stakedLp)}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-gray-500">Current Price: </p>
            <div className="flex items-center gap-1">
              <TokenPriceDisplay
                price={1}
                token={selectedPool.lpToken.token1}
                isLoading={false}
              />
              {"="}
              <TokenPriceDisplay
                price={selectedPool.priceBperA}
                token={selectedPool.lpToken.token2}
                isLoading={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
