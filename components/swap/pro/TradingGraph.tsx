"use client";

import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

export function TradingGraph() {
  return (
    <div className="bg-black-900 flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className={cn(text.hsb2(), "mb-2 text-gray-400")}>
          [Trading Graph]
        </div>
        <div className={cn(text.sb3(), "text-gray-600")}>
          Chart visualization will be displayed here
        </div>
      </div>
    </div>
  );
}
