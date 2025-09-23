"use client";

import Image from "next/image";
import ChevronDown from "@/assets/icons/chevron-down.svg";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface TokenSelectProps {
  value: TokenProfile;
  onChange?: (value: TokenProfile) => void;
  options: TokenProfile[];
}

export function TokenSelect({ value, options }: TokenSelectProps) {
  const selected = options.find((t) => t.symbol === value.symbol);

  return (
    <Button
      variant="outline"
      className="h-fit w-fit gap-2 rounded-2xl border-1 border-white/10 bg-white/5 p-[6px]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
        <Image
          src={selected?.image ?? ""}
          alt={selected?.symbol ?? ""}
          className="h-6 w-6 rounded-full"
        />
      </div>
      <span className={cn(text.b3(), "text-gray-300")}>{selected?.symbol}</span>
      <ChevronDown />
    </Button>
  );
}
