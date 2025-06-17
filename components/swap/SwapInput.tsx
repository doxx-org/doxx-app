"use client";

import { TokenSelect } from "@/components/swap/TokenSelect";
import Wallet from "@/assets/icons/wallet.svg";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { text } from "@/lib/text";

interface CoinOption {
  value: string;
  symbol: string;
  img: string;
}

interface SwapInputProps {
  coin: string;
  onCoinChange?: (value: string) => void;
  coinOptions: CoinOption[];
  amount: string;
  onAmountChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SwapInput({
  coin,
  onCoinChange,
  coinOptions,
  amount,
  onAmountChange,
  placeholder = "0.00",
  disabled = false,
  className,
}: SwapInputProps) {
  return (
    <div
      className={cn(
        text.sb3(),
        "flex flex-col items-center gap-4 bg-black-700 px-4 pt-4 pb-5 rounded-t-xl",
        className
      )}
    >
      <div className='flex flex-row justify-between w-full items-center'>
        <p className='text-white'>Selling</p>
        <div className='flex items-center gap-[6px]'>
          <Wallet />
          <p className='text-gray-600'>1,000</p>
          <p className='text-gray-600'>{coinOptions.find((c) => c.value === coin)?.symbol}</p>
          <Button variant='adjust' className='text-gray-600 px-3 py-1 h-fit'>
            HALF
          </Button>
          <Button variant='adjust' className='text-gray-600 px-3 py-1 h-fit'>
            MAX
          </Button>
        </div>
      </div>
      <div className='flex items-center justify-between w-full'>
        <div className='flex '>
          <TokenSelect value={coin} onChange={onCoinChange} options={coinOptions} />
        </div>
        <div className='flex flex-col overflow-hidden'>
          {disabled}
          <input
            type='text'
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            className={cn(text.sh1(), "flex-1 text-right text-gray-600 outline-none")}
            placeholder={placeholder}
            disabled={disabled}
          />
          <p className='text-gray-600 text-right'>$0.00</p>
        </div>
      </div>
    </div>
  );
}
