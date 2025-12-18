"use client";

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
}: TokenSelectionRowProps) => {
  return (
    <div className="flex w-full flex-col items-start justify-start gap-4">
      <TokenLabel
        token={token}
        label={label}
        disableTokenSelect={disableTokenSelect}
        onTokenSelect={onTokenSelect}
      />
      {/* <div
        className={cn(
          "flex max-w-full min-w-27 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-2.5",
          disableTokenSelect
            ? "cursor-not-allowed"
            : "hover:cursor-pointer hover:bg-gray-700/50",
        )}
        onClick={onTokenSelect}
      >
        {token ? (
          <div className="flex min-w-0 flex-row items-center gap-2">
            <div className="flex items-center justify-center rounded-full">
              <Avatar className="z-10 size-8 bg-white/5">
                <AvatarImage src={token.image} alt={token.symbol} />
                <AvatarUnknownFallback className="border-none bg-white/5" />
              </Avatar>
            </div>
            <span className={cn(text.b3(), "truncate text-gray-300")}>
              {token.symbol}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-row items-center gap-2">
            <div className="size-8 rounded-full bg-white/5" />
            <span className={cn(text.b3(), "truncate text-gray-300")}>
              {label}
            </span>
          </div>
        )}
        {!disableTokenSelect && <ChevronDown className="h-4 w-4" />}
      </div> */}
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
            {formatNumber(balance, {
              abbreviate: { apply: true },
              decimals: 6,
            })}
          </span>
        </div>
        <span className="text-gray-600">
          $
          {formatNumber(usdValue, {
            abbreviate: { apply: true },
            decimals: 2,
          })}
        </span>
      </div>
    </div>
  );
};
