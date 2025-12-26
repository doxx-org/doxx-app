import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

// Fee tier configuration matching the AMM program's config indexes
export const FEE_TIERS = [
  {
    index: 0,
    fee: 0.25,
    label: (
      <div className="flex flex-row items-center gap-1">
        <span>0.25% fee</span>
        <span className={cn(text.sb3(), "text-green")}>(default)</span>
      </div>
    ),
    description: "For testing purposes",
  },
  {
    index: 1,
    fee: 0.15,
    label: "0.15% fee",
    description: "Best for very stable pairs",
  },
  {
    index: 2,
    fee: 0.35,
    label: "0.35% fee",
    description: "Best for stable pairs",
  },
  // { index: 3, fee: 0.3, label: "0.3% fee", description: "Best for most pairs" },
  // {
  //   index: 4,
  //   fee: 1.0,
  //   label: "1.0% fee",
  //   description: "Best for exotic pairs",
  // },
];

interface IFeeTierSelectionProps {
  selectedFeeIndex: number;
  onSelectFeeIndex: (feeIndex: number) => void;
}

export const FeeTierSelection = ({
  selectedFeeIndex,
  onSelectFeeIndex,
}: IFeeTierSelectionProps) => {
  const handleSelectFeeIndex = (feeIndex: number) => {
    onSelectFeeIndex(feeIndex);
    setIsFeeSelectionOpen(false);
  };

  const [isFeeSelectionOpen, setIsFeeSelectionOpen] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h3 className={cn(text.b4(), "px-3 text-gray-400")}>Select Pool</h3>
          </div>
          <p className={cn(text.sb3(), "px-3 pt-3 text-gray-600")}>
            Select a pool type based on your preferred liquidity provider fee.
          </p>
        </div>
      </div>
      {/* Fee Tier Selector */}
      <button
        onClick={() => setIsFeeSelectionOpen(!isFeeSelectionOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 transition-colors hover:cursor-pointer hover:bg-gray-700/50",
        )}
      >
        <div className={cn(text.b3(), "flex items-center gap-1 text-gray-300")}>
          <span>Select a fee tier </span>
          <span className={cn(text.sb3(), "text-green")}>
            ({FEE_TIERS[selectedFeeIndex].fee}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFeeSelectionOpen && (
            <span className={cn(text.sb3(), "text-gray-400")}>Hide</span>
          )}
          {isFeeSelectionOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Fee Tier Options */}
      {isFeeSelectionOpen && (
        <div className="grid grid-cols-2 gap-3">
          {FEE_TIERS.map((tier) => (
            <button
              key={`fee-tier-${tier.index}`}
              onClick={() => {
                handleSelectFeeIndex(tier.index);
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-4 transition-all hover:cursor-pointer hover:bg-gray-700/30",
                selectedFeeIndex === tier.index
                  ? "border-green bg-green/10"
                  : "border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-700/30",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className={cn(text.b3(), "font-semibold text-white")}>
                  {tier.label}
                </span>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    selectedFeeIndex === tier.index
                      ? "border-green"
                      : "border-dashed border-gray-600",
                  )}
                >
                  {selectedFeeIndex === tier.index && (
                    <div className="bg-green h-3 w-3 rounded-full" />
                  )}
                </div>
              </div>
              <span className={cn(text.sb3(), "text-left text-gray-500")}>
                {tier.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
