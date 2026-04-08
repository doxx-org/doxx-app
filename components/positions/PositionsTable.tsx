"use client";

import { DataTable } from "@/components/ui/data-table";
import { positionColumns } from "./PositionColumns";
import { UnifiedPositionRow } from "./types";

interface PositionsTableProps {
  data: UnifiedPositionRow[];
  isLoading: boolean;
}

export function PositionsTable({ data, isLoading }: PositionsTableProps) {
  return (
    <div className="h-full min-h-[400px] w-full">
      <DataTable
        columns={positionColumns}
        data={data}
        pageSize={10}
        isLoading={isLoading}
      />
    </div>
  );
}
