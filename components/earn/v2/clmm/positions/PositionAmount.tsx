import { Skeleton } from "@/components/ui/skeleton";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { Pool } from "../../types";

interface PositionAmountProps {
  position: IPositionWithValue;
  selectedPool: Pool;
  isLoading: boolean;
}

export const PositionAmount = ({
  position,
  selectedPool,
  isLoading,
}: PositionAmountProps) => {
  return (
    <div className="bg-black-700 flex items-center justify-between rounded-lg p-4">
      <div className={cn(text.hsb2(), "flex gap-1")}>
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <>
            <p className="text-gray-200">
              {position.amount0}
              {"-"}
              {position.amount1}
            </p>
            <p className="text-gray-400">
              {selectedPool.lpToken.token1.symbol}
              {"/"}
              {selectedPool.lpToken.token2.symbol}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <p className={cn(text.sb3(), "text-gray-400")}>Position:</p>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <p className={cn(text.sb3(), "text-green font-medium")}>
            ${formatNumber(position.positionValue)}
          </p>
        )}
      </div>
    </div>
  );
};
