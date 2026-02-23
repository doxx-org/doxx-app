import { TokenPriceDisplay } from "@/components/TokenPriceDisplay";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

const removeLiquidityRatioOptions = [
  {
    label: "25%",
    value: 25,
  },
  {
    label: "50%",
    value: 50,
  },
  {
    label: "75%",
    value: 75,
  },
  {
    label: "MAX",
    value: 100,
  },
];

export const RemoveLiquidityPanel = ({
  removeLiquidityRatio,
  handleAdjustRemoveLiquidityRatio,
}: {
  removeLiquidityRatio: number;
  handleAdjustRemoveLiquidityRatio: (ratio: number) => void;
}) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4 py-6">
      <p className={cn(text.hsb3(), "text-white")}>Remove Liquidity</p>
      {/* Remove liquiity panel */}
      <div className="flex w-full flex-col gap-6 rounded-[12px] border border-gray-800 bg-gray-900 px-4 py-5">
        {/* Remove Liquidity Ratio */}
        <div className="flex w-full items-center justify-between">
          <p className={cn(text.hsb1(), "leading-none text-gray-50")}>
            {removeLiquidityRatio}%
          </p>
          <div className="flex gap-1">
            {removeLiquidityRatioOptions.map((option) => (
              <Button
                key={option.value}
                className={cn(
                  text.sbx3(),
                  "!h-8 max-h-8 min-w-17.5 rounded-[8px] border border-gray-700 bg-gray-700 py-2.5 leading-none text-gray-200 hover:border-gray-600 hover:bg-gray-600",
                  removeLiquidityRatio === option.value &&
                    "bg-green/20 border-green text-green hover:bg-green/20 hover:border-green",
                )}
                onClick={() => handleAdjustRemoveLiquidityRatio(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Slider */}
        <Slider
          className="w-full"
          value={[removeLiquidityRatio]}
          onValueChange={(value) => {
            handleAdjustRemoveLiquidityRatio(value[0]);
          }}
          min={0}
          max={100}
          step={0.01}
        />
      </div>
    </div>
  );
};
