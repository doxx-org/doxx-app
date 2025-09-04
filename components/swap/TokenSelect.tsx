"use client";

import ChevronDown from "@/assets/icons/chevron-down.svg";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface TokenOption {
  value: string;
  symbol: string;
  image: string;
}

interface TokenSelectProps {
  value: string;
  onChange?: (value: string) => void;
  options: TokenOption[];
}

export function TokenSelect({ value, options }: TokenSelectProps) {
  const selected = options.find((t) => t.value === value);

  return (
    <Button
      variant="outline"
      className="h-fit w-fit gap-2 rounded-2xl border-1 border-white/10 bg-white/5 p-[6px]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
        <img
          src={selected?.image}
          alt={selected?.symbol}
          className="h-6 w-6 rounded-full"
        />
      </div>
      <span className={cn(text.b3(), "text-gray-300")}>{selected?.symbol}</span>
      <ChevronDown />
    </Button>
  );
}
