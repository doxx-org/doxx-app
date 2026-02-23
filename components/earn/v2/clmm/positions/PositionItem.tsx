import { useMemo } from "react";
import { CopyIcon } from "lucide-react";
import { Link } from "@/components/Link";
import { TokenPriceDisplay } from "@/components/TokenPriceDisplay";
import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TokenProfile } from "@/lib/config/tokens";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { copyToClipboard, text } from "@/lib/text";
import { cn, ellipseAddress, formatNumber } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";
import { Pool } from "../../types";

const PositionInRange = ({
  position,
  currentTick,
  tickLower,
  tickUpper,
  isLoading,
}: {
  position: IPositionWithValue;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  isLoading: boolean;
}) => {
  const isInRange = useMemo(() => {
    return tickLower <= currentTick && currentTick < tickUpper;
  }, [currentTick, tickLower, tickUpper]);

  if (isLoading) {
    return <Skeleton className="h-4 w-20" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={cn(
            text.sb4(),
            "bg-green/10 hover:bg-green/20 flex items-center gap-2 rounded-sm px-2 py-1.5",
          )}
        >
          <div
            className={cn(
              "size-1.25 rounded-full",
              isInRange ? "bg-green" : "bg-orange",
            )}
          />
          {isInRange ? "In Range" : "Out of Range"}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className={cn(text.sb3(), "flex items-center gap-1")}>
          <p>Position:</p>
          <Link
            className={"hover:text-green text-gray-400 hover:cursor-pointer"}
            href={getTokenExplorerUrl(position.publicKey.toString())}
          >
            {ellipseAddress(position.publicKey.toString())}
          </Link>
          <CopyIcon
            className="h-2.5 w-2.5 cursor-pointer"
            onClick={() => copyToClipboard(position.publicKey.toString())}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const RewardToken = ({
  token,
  rewardAmount,
  isLoading,
}: {
  token: TokenProfile | undefined;
  rewardAmount: number;
  isLoading: boolean;
}) => {
  if (isLoading) {
    return <Skeleton className="h-4 w-10" />;
  }

  return (
    <div
      className={cn(
        text.sb3(),
        "flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-gray-200",
      )}
    >
      <Avatar className="size-3.5 bg-gray-700">
        <AvatarImage src={token?.image} alt={token?.symbol} />
        <AvatarUnknownFallback className="border-none bg-gray-700" />
      </Avatar>
      <p>{formatNumber(rewardAmount)}</p>
    </div>
  );
};

const RewardInfo = ({
  rewardAmount,
  rewardValue,
  token,
  isLoading,
}: {
  rewardAmount: number;
  rewardValue: number | undefined;
  token: TokenProfile | undefined;
  isLoading: boolean;
}) => {
  if (!token)
    return (
      <RewardToken
        token={token}
        rewardAmount={rewardAmount}
        isLoading={isLoading}
      />
    );

  return (
    <Tooltip>
      <TooltipTrigger>
        <RewardToken
          token={token}
          rewardAmount={rewardAmount}
          isLoading={isLoading}
        />
      </TooltipTrigger>
      <TooltipContent>
        <div className={cn(text.sb3(), "flex flex-col gap-1")}>
          <div className="flex items-center gap-1">
            <p>Symbol:</p>
            <p className={"text-gray-400"}>{token.symbol}</p>
          </div>
          <div className="flex items-center gap-1">
            <p>Value ($):</p>
            <p className={"text-gray-400"}>
              ${rewardValue !== undefined ? formatNumber(rewardValue) : "-"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <p>Address:</p>
            <Link
              className={"hover:text-green text-gray-400 hover:cursor-pointer"}
              href={getTokenExplorerUrl(token.address.toString())}
            >
              {ellipseAddress(token.address.toString())}
            </Link>
            <CopyIcon
              className="h-2.5 w-2.5 cursor-pointer"
              onClick={() => copyToClipboard(token.address.toString())}
            />
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export const PositionItem = ({
  position,
  selectedPool,
  positionIndex,
  isLoading,
}: {
  position: IPositionWithValue;
  selectedPool: Pool;
  positionIndex: number;
  isLoading: boolean;
}) => {
  return (
    <div className="flex flex-col gap-5 border-b border-gray-800 px-4 py-6">
      {/* Position In Range */}
      <div className="flex items-center justify-between">
        <PositionInRange
          position={position}
          currentTick={position.pool.tickCurrent}
          tickLower={position.account.tickLowerIndex}
          tickUpper={position.account.tickUpperIndex}
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

      {/* Potision Price */}
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

      {/* Pending Rewards */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className={cn(text.sb3(), "text-gray-400")}>Pending Rewards:</p>
          <RewardInfo
            key={`${selectedPool.poolId}-${positionIndex}-fee-token-0-${position.fees.token0.mint.toBase58()}`}
            rewardAmount={position.fees.token0.amount}
            rewardValue={position.fees.token0.valueUsd}
            token={position.fees.token0.tokenProfile}
            isLoading={isLoading}
          />
          <RewardInfo
            key={`${selectedPool.poolId}-${positionIndex}-fee-token-1-${position.fees.token1.mint.toBase58()}`}
            rewardAmount={position.fees.token1.amount}
            rewardValue={position.fees.token1.valueUsd}
            token={position.fees.token1.tokenProfile}
            isLoading={isLoading}
          />
          {position.rewardInfos.map((rewardInfo) => {
            return (
              <RewardInfo
                key={`${selectedPool.poolId}-${positionIndex}-${rewardInfo.rewardMint.toBase58()}`}
                rewardAmount={rewardInfo.pendingAmount}
                rewardValue={rewardInfo.pendingValueUsd}
                token={rewardInfo.rewardTokenProfile}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
