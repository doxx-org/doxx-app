"use client";

import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { UnifiedPositionRow } from "./types";

export function PriceRangeCell({ row }: { row: UnifiedPositionRow }) {
  return (
    <div className="flex flex-row items-center justify-end gap-2">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          row.isInRange ? "bg-green-500" : "bg-orange-400",
        )}
      />
      <span className={cn(text.sb3(), "text-gray-400")}>
        {row.isInRange ? "In Range" : "Out of Range"}
      </span>
    </div>
  );
}
