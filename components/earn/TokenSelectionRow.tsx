"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TokenProfile } from "@/utils/tokens";
import { Button } from "../ui/button";

interface TokenSelectionRowProps {
  token: TokenProfile | null;
  amount: string;
  placeholder: string;
  label: string;
  onTokenSelect: () => void;
  onAmountChange: (value: string) => void;
  disabled?: boolean;
}

export const TokenSelectionRow = ({
  token,
  amount,
  placeholder,
  label,
  onTokenSelect,
  onAmountChange,
  disabled = false,
}: TokenSelectionRowProps) => {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-4">
      <div className="flex flex-1 flex-col items-start justify-start">
        <Button
          variant="outline"
          className="h-12 min-w-40 gap-2 rounded-xl border border-gray-700 bg-gray-800/50 p-2 hover:bg-gray-700/50"
          onClick={onTokenSelect}
        >
          {token ? (
            <div className="flex flex-row items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full">
                <Image
                  width={20}
                  height={20}
                  src={token.image}
                  alt={token.symbol}
                  className="rounded-full"
                />
              </div>
              <span className={cn(text.b3(), "text-gray-300")}>
                {token.symbol}
              </span>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gray-800" />
              <span className={cn(text.b3(), "text-gray-400")}>{label}</span>
            </div>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
        <input
          type="text"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className={cn(
            text.sh1(),
            "w-20 self-end bg-transparent text-right text-gray-400 outline-none placeholder:text-gray-500",
          )}
          placeholder={placeholder}
          disabled={disabled}
        />
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <div>
            <span className={cn(text.sb3(), "text-gray-500")}>Balance:</span>
            <span className={cn(text.sb3(), "text-gray-400")}>0</span>
          </div>
          <span className={cn(text.sb3(), "text-gray-500")}>$0</span>
        </div>
      </div>
    </div>
  );
};
