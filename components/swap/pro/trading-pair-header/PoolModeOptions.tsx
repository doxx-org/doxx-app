import { SegmentedControl } from "@/components/ui/segmented-control";
import { MarketType } from "./types";

interface PoolModeOptionsProps {
  value: MarketType;
  poolModeOptions: MarketType[];
  onPoolModeChange: (value: MarketType) => void;
}

const allPoolModeOptions = Object.values(MarketType);

export const PoolModeOptions = ({
  value,
  poolModeOptions,
  onPoolModeChange,
}: PoolModeOptionsProps) => {
  const options = allPoolModeOptions.map((marketType) => ({
    value: marketType,
    label: marketType,
    disabled: !poolModeOptions.includes(marketType),
  }));

  return (
    <SegmentedControl
      value={value}
      onValueChange={(value) => {
        onPoolModeChange(value as MarketType);
      }}
      options={options}
    />
  );
};
