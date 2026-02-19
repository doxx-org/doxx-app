"use client";

import { Loader2 } from "lucide-react";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { TokenLabel } from "../TokenLabel";

interface TokenSelectionRowProps {
  token: TokenProfile | null;
  amount: string;
  placeholder: string;
  label: string;
  onTokenSelect: () => void;
  onAmountChange: (value: string) => void;
  disabled?: boolean;
  balance?: number;
  usdValue?: number;
  disableTokenSelect?: boolean;
  className?: string;
  isLoading?: boolean;
}

export const TokenSelectionRow = ({
  token,
  amount,
  placeholder,
  label,
  onTokenSelect,
  onAmountChange,
  disabled = false,
  balance = 0,
  usdValue = 0,
  disableTokenSelect = false,
  className,
  isLoading = false,
}: TokenSelectionRowProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-start justify-start gap-4",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <TokenLabel
          token={token}
          label={label}
          disableTokenSelect={disableTokenSelect}
          onTokenSelect={onTokenSelect}
        />
        {isLoading && (
          <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
        )}
      </div>
      <input
        type="text"
        value={amount !== "" ? `-${amount}` : amount}
        onChange={(e) => onAmountChange(e.target.value.replace("-", ""))}
        className={cn(
          text.sh1(),
          "h-6 w-full self-end bg-transparent text-right align-middle leading-none text-gray-600 outline-none placeholder:text-gray-600",
        )}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div
        className={cn(
          text.sb3(),
          "flex w-full flex-row items-center justify-between gap-1 leading-none",
        )}
      >
        <div className="flex flex-row items-center gap-1.5">
          <span className="text-gray-700">Balance: </span>
          <span className="text-gray-600">
            {balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: token?.displayDecimals ?? 6,
            })}
          </span>
        </div>
        <span className="min-w-0 truncate text-gray-600">
          {formatNumber(usdValue, {
            abbreviate: { apply: false },
            decimals: 2,
            prefix: "$",
          })}
        </span>
      </div>
    </div>
  );
};
