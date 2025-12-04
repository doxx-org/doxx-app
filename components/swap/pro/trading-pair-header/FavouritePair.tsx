import { useAtom } from "jotai";
import { text } from "@/lib/text";
import { favouritePairsAtom } from "@/lib/utils/atomWithStorage";
import { formatNumber } from "@/lib/utils/number";
import { cn } from "@/lib/utils/style";
import { TradingPair } from "./types";

interface FavouritePairProps {
  onSelect: (pair: TradingPair) => void;
}

export const FavouritePair = ({ onSelect }: FavouritePairProps) => {
  const [favouritePairs] = useAtom(favouritePairsAtom);

  return (
    <div
      className={cn(text.r3(), "flex items-center border-b border-gray-800")}
    >
      <span className="p-4 text-gray-50">Favourite</span>
      <div className="flex items-center">
        {favouritePairs.map((tradingPair, index) => (
          <div
            key={`favourite-pair-${index}`}
            onClick={() => {
              onSelect(tradingPair);
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-1.5 text-gray-50 transition-colors hover:cursor-pointer hover:bg-gray-800",
              index !== favouritePairs.length - 1 && "border-r border-gray-800",
            )}
          >
            <span>{tradingPair.symbol}</span>
            <span
              className={cn(
                tradingPair.change24h > 0 ? "text-green-500" : "text-red-500",
              )}
            >
              {tradingPair.change24h > 0 ? "+" : ""}
              {formatNumber(tradingPair.change24h)}%
            </span>
            <span>{formatNumber(tradingPair.lastPrice)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
