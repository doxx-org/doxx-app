"use client";

import { ReactNode, useState } from "react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNoMemo } from "@/lib/hooks/useNoMemo";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchInput?: ReactNode;
  globalFilter?: string;
  pageSize?: number;
  isShowPagination?: boolean;
  className?: {
    outer?: string;
    table?: {
      className?: string;
      searchInput?: {
        row?: string;
        head?: string;
      };
      headers?: {
        row?: string;
        head?: string;
      };
      body?: {
        className?: string;
        row?: string;
        cell?: string;
      };
    };
  };
  onSelectRow?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchInput,
  globalFilter,
  pageSize = 10,
  className,
  isShowPagination = true,
  onSelectRow,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  // const [loadedPages, setLoadedPages] = useState<number>(1);
  // const scrollContainerRef = useRef<HTMLDivElement>(null);
  // const isLoadingRef = useRef(false);

  const table = useNoMemo(() =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      onGlobalFilterChange: () => {},
      state: {
        sorting,
        globalFilter,
        pagination,
      },
    }),
  );

  // // Reset loaded pages when data or filters change
  // useEffect(() => {
  //   if (!isShowPagination) {
  //     setLoadedPages(1);
  //   }
  // }, [data, globalFilter, isShowPagination]);

  // // Infinite scroll handler
  // useEffect(() => {
  //   console.log("🚀 ~ isShowPagination:", isShowPagination);
  //   if (isShowPagination || !scrollContainerRef.current) return;

  //   const container = scrollContainerRef.current;
  //   console.log("🚀 ~ container:", container);
  //   const handleScroll = () => {
  //     if (isLoadingRef.current) return;

  //     const { scrollTop, scrollHeight, clientHeight } = container;
  //     const threshold = 100; // Load more when 100px from bottom

  //     // Get all sorted rows to check if there are more to load
  //     const allRows = table.getSortedRowModel().rows;
  //     console.log("🚀 ~ allRows:", allRows);
  //     const totalItemsToShow = loadedPages * pageSize;
  //     console.log("🚀 ~ totalItemsToShow:", totalItemsToShow);

  //     if (
  //       scrollHeight - scrollTop - clientHeight < threshold &&
  //       totalItemsToShow < allRows.length
  //     ) {
  //       isLoadingRef.current = true;
  //       setLoadedPages((prev) => prev + 1);
  //       setTimeout(() => {
  //         isLoadingRef.current = false;
  //       }, 100);
  //     }
  //   };

  //   container.addEventListener("scroll", handleScroll);
  //   return () => container.removeEventListener("scroll", handleScroll);
  // }, [isShowPagination, loadedPages, table, pageSize]);

  // Get rows to display
  // const displayRows = isShowPagination
  //   ? table.getRowModel().rows
  //   : (() => {
  //       // For infinite scroll, get all filtered/sorted rows and slice based on loaded pages
  //       // getFilteredRowModel returns all filtered rows (not paginated)
  //       // We need to get sorted rows, which are already filtered
  //       const allRows = table.getSortedRowModel().rows;
  //       const totalItemsToShow = Math.min(
  //         loadedPages * pageSize,
  //         allRows.length,
  //       );
  //       return allRows.slice(0, totalItemsToShow);
  //     })();
  const displayRows = table.getRowModel().rows;

  const isEmpty = displayRows?.length === 0;

  return (
    <div
      // ref={scrollContainerRef}
      className={cn(
        className?.outer
          ? className.outer
          : "bg-black-800 h-full overflow-hidden rounded-md border",
        isEmpty && "h-full",
        // !isShowPagination && "overflow-y-auto",
        // isShowPagination && "overflow-hidden",
      )}
    >
      <Table className={cn(isEmpty && "h-full", "w-full")}>
        <TableHeader>
          {searchInput && (
            <TableRow
              className={cn(
                className?.table?.searchInput?.row,
                "border-b border-gray-800 hover:bg-transparent",
              )}
            >
              <TableHead
                colSpan={columns.length}
                className={cn(className?.table?.searchInput?.head, "px-4 py-4")}
              >
                <div className="w-[360px]">{searchInput}</div>
              </TableHead>
            </TableRow>
          )}
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={className?.table?.headers?.row}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{
                    flex: header.getSize(),
                    width: header.getSize(),
                  }}
                  className={cn(
                    text.sb3(),
                    "px-4 text-gray-500",
                    header.index === 0 ? "text-left" : "text-right",
                    className?.table?.headers?.head,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={className?.table?.body?.className}>
          {displayRows?.length ? (
            displayRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={className?.table?.body?.row}
                onClick={() => onSelectRow?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      text.b4(),
                      "border-b border-gray-800 px-4 text-gray-300",
                      cell.column.id === "tokenName"
                        ? "text-left"
                        : "text-right",
                      className?.table?.body?.cell,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className={cn(text.sb2(), "text-center text-gray-700")}
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {isShowPagination && table.getPageCount() > 1 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <DataTablePagination table={table} />
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
