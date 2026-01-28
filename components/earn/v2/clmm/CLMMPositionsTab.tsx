import { useMemo } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { Pool } from "../../PoolColumn";

interface Position {
  id: number;
  tokenA: string;
  tokenB: string;
  amount: number;
  minPrice: number;
  maxPrice: number;
}

const mockPositions: Position[] = [
  {
    id: 1,
    tokenA: "Token A",
    tokenB: "Token B",
    amount: 100,
    minPrice: 0.1,
    maxPrice: 0.2,
  },
];

const TokenPriceDisplay = ({
  price,
  token,
}: {
  price: number;
  token: TokenProfile;
}) => {
  return (
    <div className="flex items-center gap-1">
      <Avatar className="size-4 bg-white/5">
        <AvatarImage src={token.image} alt={token.symbol} />
        <AvatarUnknownFallback className="border-none bg-white/5" />
      </Avatar>
      <p className="text-gray-200">{formatNumber(price)}</p>
    </div>
  );
};

const PositionInRange = ({
  currentPrice,
  minPrice,
  maxPrice,
}: {
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
}) => {
  const isInRange = useMemo(() => {
    return currentPrice >= minPrice && currentPrice <= maxPrice;
  }, [currentPrice, minPrice, maxPrice]);

  return (
    <div
      className={cn(
        text.sb4(),
        "bg-green/10 flex items-center gap-2 rounded-sm px-2 py-1.5",
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
  );
};

interface CLMMPositionsTabProps {
  selectedPool: Pool;
}

export const CLMMPositionsTab = ({ selectedPool }: CLMMPositionsTabProps) => {
  // const { data: positions } = usePositions(selectedPool.poolState.lpMint);
  return (
    <div className="flex flex-col px-4 py-6">
      {mockPositions.map((position) => (
        <div key={`position-${position.id}`} className="flex flex-col gap-5">
          {/* Position In Range */}
          <div className="flex items-center justify-between">
            <PositionInRange
              currentPrice={selectedPool.price}
              minPrice={position.minPrice}
              maxPrice={position.maxPrice}
            />
            <div className={cn(text.sb3(), "flex items-center gap-4")}>
              <p className="text-gray-500">Current Price: </p>
              <div className="flex items-center gap-1">
                <TokenPriceDisplay
                  price={selectedPool.price}
                  token={selectedPool.lpToken.token1}
                />
                {"="}
                <TokenPriceDisplay
                  price={selectedPool.price}
                  token={selectedPool.lpToken.token2}
                />
              </div>
            </div>
          </div>

          {/* Potision Price */}
          <div className="bg-black-700 flex items-center justify-between rounded-lg p-4">
            <div className={cn(text.hsb2(), "flex gap-1")}>
              <p className="text-gray-200">Price:</p>
              <p className="text-gray-400">
                {position.tokenA}
                {"/"}
                {position.tokenB}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <p className={cn(text.sb3(), "text-gray-400")}>Position:</p>
              <p className={cn(text.sb3(), "text-green font-medium")}>
                {/* TODO: Value */}${formatNumber(position.amount)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
