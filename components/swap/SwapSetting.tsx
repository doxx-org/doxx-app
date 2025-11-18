import { useCallback, useState } from "react";
import Gear from "@/assets/icons/gear.svg";
import {
  DropdownBody,
  DropdownHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_SLIPPAGE } from "@/lib/constants";
import { useDialogState } from "@/lib/hooks/useOpenDialog";
import { text } from "@/lib/text";
import { cn, parseDecimalsInput } from "@/lib/utils";
import { Button } from "../ui/button";

/**
 * Slippage options
 * - @value: the value of the slippage; 1 = 100%
 * - @label: the label of the slippage
 * - @isDefault: whether the slippage is the default one
 */
const slippageOptions = [
  {
    value: "0.1",
    label: "0.1%",
  },
  {
    value: "0.5",
    label: "0.5%",
  },
  {
    value: "1",
    label: "1%",
  },
];

interface SwapSettingProps {
  slippage: string;
  onSlippageChange: (slippage: string) => void;
}

export function SwapSetting({ slippage, onSlippageChange }: SwapSettingProps) {
  const { isOpen, setIsOpen } = useDialogState();
  const [customSlippage, setCustomSlippage] = useState("0");

  const handleInput = useCallback(
    (inputSlippage: string) => {
      onSlippageChange(inputSlippage);
      setCustomSlippage("0");
    },
    [onSlippageChange],
  );

  const handleCustomSlippageChange = (value: string) => {
    const inputValue = parseDecimalsInput(value);
    if (parseFloat(inputValue) > 100) {
      setCustomSlippage("100");
      onSlippageChange("100");
      return;
    }

    setCustomSlippage(inputValue);
    onSlippageChange(inputValue);
  };

  const handleInputBlur = useCallback(() => {
    // If input is empty or "0", reset to default slippage
    if (!customSlippage || customSlippage === "0" || customSlippage === "") {
      setCustomSlippage("0");
      if (slippage === "0" || slippage === "") {
        onSlippageChange(DEFAULT_SLIPPAGE);
      }
    }
  }, [customSlippage, slippage, onSlippageChange]);

  return (
    <div className="flex flex-row items-center justify-end">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger className="group flex h-fit flex-row items-center justify-end p-0">
          <div className="cursor-pointer transition-all duration-200 group-hover:scale-120">
            <Gear className="transition-all duration-200 group-hover:drop-shadow-gray-50" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          className="flex flex-col p-0"
        >
          <DropdownHeader>Setting</DropdownHeader>
          <DropdownBody className="flex flex-col gap-3 text-gray-400">
            <p className={cn(text.b3())}>Slippage</p>
            <div className="flex flex-row items-center gap-2">
              {slippageOptions.map((option) => {
                const isSelected = option.value === slippage;
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? "default" : "gray"}
                    className={cn(
                      text.sb3(),
                      "px-4 py-3 transition-colors duration-200",
                      isSelected && "text-green",
                    )}
                    onClick={() => handleInput(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
              <div
                className={cn(
                  text.sb3(),
                  "flex h-9 w-fit flex-row items-center justify-between gap-1 rounded-md border p-3 outline-none",
                  "focus-within:border-gray-50 focus-within:text-gray-50",
                  Number(customSlippage) > 0
                    ? "border-gray-50 text-gray-50"
                    : "border-gray-800",
                )}
              >
                <input
                  type="text"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippageChange(e.target.value)}
                  onBlur={handleInputBlur}
                  className={cn(
                    text.sb3(),
                    "w-6 text-left outline-none placeholder:text-gray-600",
                  )}
                  placeholder="0"
                />
                %
              </div>
            </div>
          </DropdownBody>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
