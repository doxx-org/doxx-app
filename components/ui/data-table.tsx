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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchInput,
  globalFilter,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

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

  const isEmpty = table.getRowModel().rows?.length === 0;

  return (
    <div
      className={cn(
        "bg-black-800 h-full overflow-hidden rounded-md border",
        isEmpty && "h-full",
      )}
    >
      <Table className={cn(isEmpty && "h-full", "w-full")}>
        <TableHeader>
          {searchInput && (
            <TableRow className="border-b border-gray-800 hover:bg-transparent">
              <TableHead colSpan={columns.length} className="px-4 py-4">
                <div className="w-[360px]">{searchInput}</div>
              </TableHead>
            </TableRow>
          )}
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
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
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
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
        {table.getPageCount() > 1 && (
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
