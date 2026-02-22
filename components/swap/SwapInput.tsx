"use client";

import { ReactNode } from "react";
import ChevronDown from "@/assets/icons/chevron-down.svg";
import Wallet from "@/assets/icons/wallet.svg";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Underlined } from "../Underlined";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface SwapInputProps {
  title: string;
  token: TokenProfile;
  amount: string;
  onOpenTokenSelector?: () => void;
  onAmountChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  tokenBalance: number | undefined;
  actionButtons?: ReactNode;
  isActionable: boolean;
  inputValue: number | undefined;
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
  isActionable,
  inputValue,
}: SwapInputProps) {
  return (
    <div
      className={cn(
        text.sb3(),
        "bg-black-700 flex flex-col items-center gap-4 rounded-t-xl px-4 pt-4 pb-5",
        className,
      )}
    >
      <div className="flex w-full flex-row items-center justify-between gap-4">
        <p className="text-white">{title}</p>
        <div className="flex min-w-0 items-center gap-[6px]">
          <Wallet className="size-4" />
          <p className="text-gray-600">{tokenBalance ?? "-"}</p>
          <p className="truncate text-gray-600">{token.symbol}</p>
          {actionButtons}
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex">
          <Button
            variant="outline"
            className="h-fit w-fit max-w-40 gap-2 rounded-2xl border border-white/10 bg-white/5 p-[6px]"
            disabled={!onOpenTokenSelector}
            onClick={onOpenTokenSelector}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
              <Avatar>
                <AvatarImage
                  src={token.image}
                  alt={token.symbol}
                  className="rounded-full"
                />
                <AvatarFallback>{"?"}</AvatarFallback>
              </Avatar>
            </div>
            <span className={cn(text.b3(), "truncate text-gray-300")}>
              {token.symbol}
            </span>
            <ChevronDown />
          </Button>
        </div>
        <div className="flex flex-col items-end">
          <input
            type="text"
            value={amount}
            onChange={(e) =>
              isActionable ? onAmountChange?.(e.target.value) : undefined
            }
            className={cn(
              text.sh1(),
              "w-full flex-1 text-right text-white outline-none placeholder:text-gray-600",
            )}
            placeholder={placeholder}
            disabled={disabled || !isActionable}
          />
          {inputValue !== undefined ? (
            inputValue > 0 ? (
              <p className="text-right text-gray-600">
                ${inputValue.toFixed(2)}
              </p>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <Underlined className="text-gray-600 decoration-gray-600">
                    $0.00
                  </Underlined>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-1">
                  Unable to calculate value
                </TooltipContent>
              </Tooltip>
            )
          ) : (
            <Skeleton className="h-4 w-10" />
          )}
        </div>
      </div>
    </div>
  );
}
