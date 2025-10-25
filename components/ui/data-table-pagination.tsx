import { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils/style";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount();

  return (
    <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-4 py-4">
      <button
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-black-700 text-gray-400 transition-colors hover:bg-gray-800",
          !table.getCanPreviousPage() && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="text-sm">&lt;</span>
      </button>
      <span className="text-sm text-gray-400">
        {table.getState().pagination.pageIndex + 1} of {pageCount}
      </span>
      <button
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-black-700 text-gray-400 transition-colors hover:bg-gray-800",
          !table.getCanNextPage() && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="text-sm">&gt;</span>
      </button>
    </div>
  );
}
