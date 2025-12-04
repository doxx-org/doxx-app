"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  className?: string;
}

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // onValueChange={(val) => val && onValueChange(val)}
      className={cn(
        "bg-black-700 flex items-center gap-0.5 rounded-full p-1",
        className,
      )}
    >
      {options.map((option) => {
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              text.b4(),
              "!text-[12px] font-medium",
              option.disabled &&
                "hover:!bg-black-700 cursor-not-allowed text-gray-700 hover:!text-gray-700",
              !option.disabled && "text-gray-600 hover:cursor-pointer",
              `!min-w-15.5 !rounded-full p-2.5 transition-all`,
              value.toLowerCase() === option.value.toLowerCase()
                ? "!text-green !border-green !border"
                : "",
            )}
            size="sm"
            onClick={() => !option.disabled && onValueChange(option.value)}
          >
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
