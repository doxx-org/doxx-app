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
  className?: {
    group?: string;
    item?: string;
  };
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
      className={cn(
        "bg-black-700 flex items-center gap-0.5 rounded-full p-1",
        className?.group,
      )}
    >
      {options.map((option) => {
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              text.b4(),
              option.disabled &&
                "hover:!bg-black-700 cursor-not-allowed text-gray-700 hover:!text-gray-700",
              !option.disabled && "text-gray-600 hover:cursor-pointer",
              // Always reserve border space to avoid width/height "jitter" when active.
              `box-border !min-w-15.5 !rounded-full border border-transparent p-2.5 transition-all`,
              value.toLowerCase() === option.value.toLowerCase()
                ? "!text-green border-green"
                : "",
              className?.item,
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
