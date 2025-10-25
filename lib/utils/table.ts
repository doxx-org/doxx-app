import { Row } from "@tanstack/react-table";

export function numericSort<TData>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string
): number {
  const a = parseFloat(rowA.getValue(columnId));
  const b = parseFloat(rowB.getValue(columnId));
  return a - b;
}
