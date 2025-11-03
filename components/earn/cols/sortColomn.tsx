import { Column } from "@tanstack/react-table";
import ChevronUpDown from "@/assets/icons/chevron-up-down.svg";

interface SortHeaderProps<TData> {
  column: Column<TData, unknown>;
  header: string;
}

export function SortHeader<TData>({ column, header }: SortHeaderProps<TData>) {
  return (
    <div
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="flex cursor-pointer flex-row items-center justify-end gap-1"
    >
      <p>{header}</p>
      <ChevronUpDown className="hover:stroke-gray-600" />
    </div>
  );
}
