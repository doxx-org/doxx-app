"use client";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "../ui/button";
import ChevronDown from "@/assets/icons/chevron-down.svg";

interface TokenOption {
  value: string;
  symbol: string;
  img: string;
}

interface TokenSelectProps {
  value: string;
  onChange?: (value: string) => void;
  options: TokenOption[];
}

export function TokenSelect({ value, onChange, options }: TokenSelectProps) {
  const selected = options.find((t) => t.value === value);

  return (
    <Button
      variant='outline'
      className=' bg-white/5 border-1 border-white/10 h-fit w-fit rounded-2xl gap-2 p-[6px]'
    >
      <div className='flex items-center justify-center  bg-white/5 rounded-full w-8 h-8'>
        <img src={selected?.img} alt={selected?.symbol} className='w-6 h-6' />
      </div>
      <span className='text-b3 text-gray-300'>{selected?.symbol}</span>
      <ChevronDown />
    </Button>
  );
}
