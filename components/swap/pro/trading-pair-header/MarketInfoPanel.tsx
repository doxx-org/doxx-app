import { text } from "@/lib/text";
import { formatNumber } from "@/lib/utils/number";
import { cn } from "@/lib/utils/style";
import { ellipseAddress } from "@/lib/utils/tokens";
import { PoolModeOptions } from "./PoolModeOptions";
import { MarketType, TradingPair } from "./types";

const MarketInfoItem = ({
  label,
  className,
  value,
  valueClassName,
}: {
  label: string;
  className: string;
  value: string;
  valueClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5",
        className,
      )}
    >
      <div className={cn(text.r4(), "self-start text-gray-500")}>{label}</div>
      <div className={cn(text.r3(), "self-start text-gray-50", valueClassName)}>
        {value}
      </div>
    </div>
  );
};

interface MarketInfoPanelProps {
  selectedPair: TradingPair;
  onPoolModeChange: (value: MarketType) => void;
}

export const MarketInfoPanel = ({
  selectedPair,
  onPoolModeChange,
}: MarketInfoPanelProps) => {
  return (
    <div className="flex items-center gap-6 px-4 py-2">
      <PoolModeOptions
        value={selectedPair.selectedMarketType}
        poolModeOptions={selectedPair.allMarketType}
        onPoolModeChange={(value) => {
          onPoolModeChange(value);
        }}
      />
      <div className="flex">
        <MarketInfoItem
          className="min-w-20.5"
          label="Price"
          value={formatNumber(selectedPair.lastPrice)}
        />
        <MarketInfoItem
          className="min-w-31.5"
          label="24h Change"
          value={`${formatNumber(selectedPair.change24h)}% (${selectedPair.change24hValue > 0 ? "+" : "-"}$${formatNumber(selectedPair.change24hValue)})`}
          valueClassName={cn(
            selectedPair.change24h === 0
              ? ""
              : selectedPair.change24h < 0
                ? "text-red-500"
                : "text-green-500",
          )}
        />
        <MarketInfoItem
          className="min-w-24"
          label="Market Cap"
          value={
            selectedPair.marketCap
              ? formatNumber(selectedPair.marketCap, {
                  abbreviate: { apply: true, prefix: " " },
                })
              : "-"
          }
        />
        <MarketInfoItem
          className="min-w-24"
          label="24h Volume"
          value={
            selectedPair.volume24h
              ? formatNumber(selectedPair.volume24h, {
                  abbreviate: { apply: true, prefix: " " },
                })
              : "-"
          }
        />
        <MarketInfoItem
          className="min-w-22.75"
          label="Contract"
          value={
            selectedPair.address ? ellipseAddress(selectedPair.address, 4) : "-"
          }
        />
      </div>
    </div>
  );
};
