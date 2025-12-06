import { ArrowRight, ChevronDown, InfoIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";

const PERCENTAGE_BUTTONS = [10, 25, 50, 75, 100];

interface TradeMarketPanelProps {
  balance: number;
  inputAmount: string;
  onInputAmountChange: (value: string) => void;
  ethAmount: number;
  totalValue: number;
  gasFee: string;
  slippage: string;
}

export const TradeMarketPanel = ({
  balance,
  inputAmount,
  onInputAmountChange,
  ethAmount,
  totalValue,
  gasFee,
  slippage,
}: TradeMarketPanelProps) => {
  return (
    <div className="flex flex-col gap-3">
      {/* USD Input */}
      <div className="flex flex-col gap-4 rounded-[12px] border border-gray-700 bg-gray-900 p-3">
        <div className="flex items-center justify-between">
          {/* Token Selector */}
          <div className="hover:bg-gray-750 flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800 p-1.5 hover:cursor-pointer">
            <Avatar className="size-6">
              <AvatarImage src="/images/usd.png" alt="USD" />
              <AvatarFallback className="size-6 bg-gray-700">
                {"?"}
              </AvatarFallback>
            </Avatar>
            <span className={cn(text.hsb2(), "leading-none text-gray-50")}>
              USD
            </span>
            <ChevronDown className="size-4 text-gray-400" />
          </div>
          {/* Input Amount */}
          <div className="flex flex-col gap-2 text-right text-gray-700">
            <input
              type="text"
              value={inputAmount}
              onChange={(e) => {
                onInputAmountChange(e.target.value);
              }}
              className={cn(
                text.b2(),
                "bg-transparent text-right leading-none outline-none placeholder:text-gray-700 focus-visible:ring-0",
              )}
              placeholder="-0.00"
            />
            <span className={cn(text.sb3(), "leading-none")}>$0</span>
          </div>
        </div>
        {/* Balance Display */}
        <div
          className={cn(text.sb4(), "gap1.5 flex items-center text-gray-600")}
        >
          Balance:{" "}
          {balance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          USD
        </div>
        {/* Percentage Buttons */}
        <div className="flex w-full justify-between gap-1">
          {PERCENTAGE_BUTTONS.map((percentage) => (
            <Button
              key={`balance-percentage-${percentage}`}
              variant="gray"
              size="sm"
              className={cn(text.sb3(), "grow")}
            >
              {percentage === 100 ? "MAX" : `${percentage}%`}
            </Button>
          ))}
        </div>
      </div>
      {/* Place order details */}
      <div className="flex flex-col gap-4 p-2">
        {/* Conversion details */}
        <div className="flex items-center justify-between">
          {/* USD to ETH conversion */}
          <div
            className={cn(
              text.b4(),
              "flex items-center gap-2 leading-4 text-gray-400",
            )}
          >
            <span>
              {formatNumber(parseFloat(inputAmount || "0"), {
                abbreviate: { apply: true },
              })}{" "}
              USD
            </span>
            <ArrowRight className="size-2 text-white" />
            <span className="leading-none">
              {formatNumber(ethAmount, {
                abbreviate: { apply: true },
                decimals: 6,
              })}{" "}
              ETH
            </span>
          </div>
          {/* Total value */}
          <span className={cn(text.sb3(), "leading-none text-gray-600")}>
            =$ {formatNumber(totalValue, { abbreviate: { apply: true } })}
          </span>
        </div>
        <div className="border-b border-gray-800" />

        {/* Gas fee */}
        <div
          className={cn(
            text.sb3(),
            "flex items-center justify-between text-gray-600",
          )}
        >
          <div className="flex items-center gap-1.5">
            {"Gas fee"}
            <InfoIcon className="size-3 text-gray-700" />
          </div>
          <span>{gasFee}</span>
        </div>
        <div
          className={cn(
            text.sb3(),
            "flex items-center justify-between text-gray-600",
          )}
        >
          <div className="flex items-center gap-1.5">
            {"Slippage"}
            <InfoIcon className="size-3 text-gray-700" />
          </div>
          <span>{slippage}</span>
        </div>
      </div>
    </div>
  );
};
