import { useEffect } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { PriceMode } from "../types";
import { CLMMPriceRange } from "./CLMMPriceRange";
import { LiquidityRangeChart } from "./LiquidityRangeChart";

interface DepositRangeProps {
  priceMode: PriceMode;
  setPriceMode: (priceMode: PriceMode) => void;
  currentPrice?: number;
  minPrice: string;
  maxPrice: string;
  handleMinPriceChange: (value: string) => void;
  handleMaxPriceChange: (value: string) => void;
}
export const DepositRange = ({
  priceMode,
  setPriceMode,
  currentPrice,
  minPrice,
  maxPrice,
  handleMinPriceChange,
  handleMaxPriceChange,
}: DepositRangeProps) => {
  useEffect(() => {
    if (priceMode !== PriceMode.CUSTOM) return;
    if (!currentPrice || !Number.isFinite(currentPrice)) return;
    if (minPrice !== "" || maxPrice !== "") return;

    // Default to a +/-5% range around current price (matches the screenshot UX).
    handleMinPriceChange((currentPrice * 0.95).toFixed(6));
    handleMaxPriceChange((currentPrice * 1.05).toFixed(6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode, currentPrice]);

  return (
    <div className="flex flex-col items-center justify-between gap-4 px-4 pt-4">
      <SegmentedControl
        value={priceMode}
        onValueChange={(value) =>
          setPriceMode(
            value === PriceMode.CUSTOM ? PriceMode.CUSTOM : PriceMode.FULL,
          )
        }
        options={[
          { value: PriceMode.FULL, label: "Full" },
          { value: PriceMode.CUSTOM, label: "Custom" },
        ]}
        className={{
          group: "w-full justify-between !rounded-xl bg-gray-800",
          item: cn(
            text.b3(),
            "hover:bg-gray-750 h-9.5 flex-1 !rounded-lg px-0 py-3 text-center text-gray-500",
          ),
        }}
      />
      {priceMode === PriceMode.CUSTOM && (
        <div className="flex w-full flex-col gap-4">
          {currentPrice && Number.isFinite(currentPrice) && (
            <LiquidityRangeChart
              currentPrice={currentPrice}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onMinPriceChange={handleMinPriceChange}
              onMaxPriceChange={handleMaxPriceChange}
              domainPaddingPct={30}
            />
          )}
          <CLMMPriceRange
            minPrice={minPrice}
            maxPrice={maxPrice}
            handleMinPriceChange={handleMinPriceChange}
            handleMaxPriceChange={handleMaxPriceChange}
          />
        </div>
      )}
    </div>
  );
};
