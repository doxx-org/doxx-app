import { MinusIcon } from "lucide-react";
import { TokenAmountTooltip } from "@/components/TokenAmount";
import { TokenPriceDisplay } from "@/components/TokenPriceDisplay";
import { Button } from "@/components/ui/button";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Pool } from "../../types";
import { PositionAction } from "./CLMMPositionsTab";
import { PositionAmount } from "./PositionAmount";
import { PositionRangeLabel } from "./PositionRangeLabel";

interface PositionItemProps {
  position: IPositionWithValue;
  selectedPool: Pool;
  positionIndex: number;
  isLoading: boolean;
  onSelectPosition: (
    position: IPositionWithValue,
    action: PositionAction,
  ) => void;
}

export const PositionItem = ({
  position,
  selectedPool,
  positionIndex,
  isLoading,
  onSelectPosition,
}: PositionItemProps) => {
  return (
    <div className="flex flex-col gap-5 border-b border-gray-800 px-4 py-6">
      {/* Position In Range */}
      <div className="flex items-center justify-between">
        <PositionRangeLabel
          position={position}
          currentTick={position.pool.tickCurrent}
          tickLower={position.positionLayout.tickLower}
          tickUpper={position.positionLayout.tickUpper}
          isLoading={isLoading}
        />
        <div className={cn(text.sb3(), "flex items-center gap-4")}>
          <p className="text-gray-500">Current Price: </p>
          <div className="flex items-center gap-1">
            <TokenPriceDisplay
              price={1}
              token={selectedPool.lpToken.token1}
              isLoading={isLoading}
            />
            {"="}
            <TokenPriceDisplay
              price={selectedPool.priceBperA}
              token={selectedPool.lpToken.token2}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Position Amount */}
      <PositionAmount
        position={position}
        selectedPool={selectedPool}
        isLoading={isLoading}
      />

      {/* Pending Rewards */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className={cn(text.sb3(), "text-gray-400")}>Pending Rewards:</p>
          <TokenAmountTooltip
            key={`${selectedPool.poolId}-${positionIndex}-fee-token-0-${position.fees.token0.mint.toBase58()}`}
            amount={position.fees.token0.amount}
            value={position.fees.token0.valueUsd}
            token={position.fees.token0.tokenProfile}
            isLoading={isLoading}
            formatter={{
              decimals: position.fees.token0.tokenProfile?.displayDecimals ?? 6,
              minimumDecimals:
                position.fees.token0.tokenProfile?.displayDecimals ?? 6,
            }}
          />
          <TokenAmountTooltip
            key={`${selectedPool.poolId}-${positionIndex}-fee-token-1-${position.fees.token1.mint.toBase58()}`}
            amount={position.fees.token1.amount}
            value={position.fees.token1.valueUsd}
            token={position.fees.token1.tokenProfile}
            isLoading={isLoading}
            formatter={{
              decimals: position.fees.token1.tokenProfile?.displayDecimals ?? 6,
              minimumDecimals:
                position.fees.token1.tokenProfile?.displayDecimals ?? 6,
            }}
          />
          {position.rewardInfos.map((rewardInfo) => {
            return (
              <TokenAmountTooltip
                key={`${selectedPool.poolId}-${positionIndex}-${rewardInfo.rewardMint.toBase58()}`}
                amount={rewardInfo.pendingAmount}
                value={rewardInfo.pendingValueUsd}
                token={rewardInfo.rewardTokenProfile}
                isLoading={isLoading}
                formatter={{
                  decimals: rewardInfo.rewardTokenProfile?.displayDecimals ?? 6,
                  minimumDecimals:
                    rewardInfo.rewardTokenProfile?.displayDecimals ?? 6,
                }}
              />
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button
            className="bg-green/15 hover:bg-black-700 hover:border-green/70 border-green text-green !h-8 max-h-8 min-h-8 !w-10 max-w-10 min-w-10 rounded-[12px] border p-0"
            onClick={() => onSelectPosition(position, PositionAction.DECREASE)}
          >
            <MinusIcon className="h-2 w-2" />
          </Button>
          {/* <Button
            className="bg-green text-black-900 border-green hover:bg-green/80 hover:border-green/80 !h-8 max-h-8 min-h-8 !w-10 max-w-10 min-w-10 rounded-[12px] border p-0"
            onClick={() => onSelectPosition(position, PositionAction.INCREASE)}
          >
            <PlusIcon className="h-2 w-2" />
          </Button> */}
        </div>
      </div>
    </div>
  );
};
