"use client";

import { ReactNode } from "react";
import Image from "next/image";
import ChevronDown from "@/assets/icons/chevron-down.svg";
import Wallet from "@/assets/icons/wallet.svg";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface SwapInputProps {
  title: string;
  token: TokenProfile;
  amount: string;
  onOpenTokenSelector: () => void;
  onAmountChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  tokenBalance: number | undefined;
  actionButtons?: ReactNode;
}

export function SwapInput({
  title,
  token,
  amount,
  onOpenTokenSelector,
  onAmountChange,
  placeholder = "0.00",
  disabled = false,
  className,
  tokenBalance,
  actionButtons,
}: SwapInputProps) {
  return (
    <div
      className={cn(
        text.sb3(),
        "bg-black-700 flex flex-col items-center gap-4 rounded-t-xl px-4 pt-4 pb-5",
        className,
      )}
    >
      <div className="flex w-full flex-row items-center justify-between">
        <p className="text-white">{title}</p>
        <div className="flex items-center gap-[6px]">
          <Wallet />
          <p className="text-gray-600">{tokenBalance ?? "-"}</p>
          <p className="text-gray-600">{token.symbol}</p>
          {actionButtons}
        </div>
      </div>
      <div className="flex w-full items-center justify-between">
        <div className="flex">
          <Button
            variant="outline"
            className="h-fit w-fit gap-2 rounded-2xl border-1 border-white/10 bg-white/5 p-[6px]"
            onClick={onOpenTokenSelector}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
              <Image
                width={24}
                height={24}
                src={token.image}
                alt={token.symbol}
                className="rounded-full"
              />
            </div>
            <span className={cn(text.b3(), "text-gray-300")}>
              {token.symbol}
            </span>
            <ChevronDown />
          </Button>
        </div>
        <div className="flex flex-col overflow-hidden">
          <input
            type="text"
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            className={cn(
              text.sh1(),
              "flex-1 text-right text-white outline-none placeholder:text-gray-600",
            )}
            placeholder={placeholder}
            disabled={disabled}
          />
          <p className="text-right text-gray-600">$0.00</p>
        </div>
      </div>
    </div>
  );
}
