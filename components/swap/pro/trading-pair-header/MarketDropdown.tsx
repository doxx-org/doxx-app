import { useMemo, useState } from "react";
import { Column, ColumnDef } from "@tanstack/react-table";
import { useAtom } from "jotai";
import { ChevronDown, CopyIcon, StarIcon, XIcon } from "lucide-react";
import ChevronUpDown from "@/assets/icons/chevron-up-down.svg";
import { SearchInput } from "@/components/SearchInput";
import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownBody,
  DropdownHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard, text } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";
import { favouritePairsAtom } from "@/lib/utils/atomWithStorage";
import { formatNumber } from "@/lib/utils/number";
import { cn } from "@/lib/utils/style";
import { numericSort } from "@/lib/utils/table";
import { mockMarketPairs } from "../../ProSwapWidget";
import { TradingPair } from "./types";

interface MarketDropdownProps {
  selectedPair: TradingPair;
  onSelect: (pair: TradingPair) => void;
}

interface SortHeaderProps<TData> {
  column: Column<TData, unknown>;
  header: string;
}

function SortHeader<TData>({ column, header }: SortHeaderProps<TData>) {
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

const marketDropdownColumns = (
  favouritePairs: TradingPair[],
  handleAddOrRemoveFavourites: (pair: TradingPair) => void,
): ColumnDef<TradingPair>[] => [
  {
    id: "tokenName",
    header: "Token Name",
    cell: ({ row }) => (
      <div className="flex flex-row items-center gap-4">
        <div className={cn(text.sb3(), "text-gray-500 hover:cursor-pointer")}>
          <StarIcon
            className={cn(
              "h-4 w-4",
              favouritePairs.some((p) => p.address === row.original.address)
                ? "fill-yellow-500 text-yellow-500"
                : "fill-gray-500 text-gray-500",
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleAddOrRemoveFavourites(row.original);
            }}
          />
        </div>
        <TradingPairInfo pair={row.original} />
      </div>
    ),
  },
  {
    id: "lastPrice",
    accessorKey: "lastPrice",
    header: ({ column }) => <SortHeader column={column} header="Last Price" />,
    cell: ({ row }) => (
      <div
        className={cn(
          text.b4(),
          "flex flex-row justify-end gap-2 text-gray-300 hover:cursor-pointer",
        )}
      >
        {"$"}
        {formatNumber(row.original.lastPrice)}
      </div>
    ),
    sortingFn: numericSort,
  },
  {
    id: "change",
    accessorKey: "change24h",
    header: ({ column }) => <SortHeader column={column} header="Change" />,
    cell: ({ row }) => (
      <div
        className={cn(
          text.b4(),
          "hover:cursor-pointer",
          row.original.change24h < 0 ? "text-red-500" : "text-green-500",
        )}
      >
        {formatNumber(row.original.change24h)}%
      </div>
    ),
    sortingFn: numericSort,
  },
];

const TradingPairInfo = ({ pair }: { pair: TradingPair }) => {
  return (
    <div className="flex w-full flex-row items-center gap-4 hover:cursor-pointer">
      <Avatar>
        <AvatarImage src={pair.iconUrl} alt={pair.symbol} />
        <AvatarUnknownFallback />
      </Avatar>
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            text.sb3(),
            "flex flex-row items-center gap-2 text-gray-500",
          )}
        >
          <span className={cn(text.b3(), "text-gray-200")}>{pair.symbol}</span>
          <div className="flex flex-row items-center gap-1">
            {pair.allMarketType.map((c) => {
              return (
                <div
                  key={`trading-pair-info-${pair.address}-${c}`}
                  className={cn(
                    text.sb4(),
                    "bg-black-700 rounded-md px-2 py-0.5 text-gray-500",
                  )}
                >
                  {c}
                </div>
              );
            })}
          </div>
        </div>
        <div
          className={cn(
            text.b4(),
            "flex flex-row items-center gap-2 text-gray-500",
          )}
        >
          {ellipseAddress(pair.address)}
          <CopyIcon
            className="h-3 w-3"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(pair.address);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const MarketDropdown = ({
  selectedPair,
  onSelect,
}: MarketDropdownProps) => {
  const [favouritePairs, setFavouritePairs] = useAtom(favouritePairsAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredMarketPairs: TradingPair[] = useMemo(() => {
    const filteredPairs = mockMarketPairs.filter(
      (pair) =>
        pair.symbol.toLowerCase().includes(search.toLowerCase()) ||
        pair.address.toLowerCase().includes(search.toLowerCase()) ||
        pair.allMarketType.some((type) =>
          type.toLowerCase().includes(search.toLowerCase()),
        ),
    );

    const sortedPairs = filteredPairs.sort((a, b) => {
      if (
        favouritePairs.some(
          (p) => p.address.toLowerCase() === a.address.toLowerCase(),
        )
      ) {
        return -1;
      }
      if (
        favouritePairs.some(
          (p) => p.address.toLowerCase() === b.address.toLowerCase(),
        )
      ) {
        return 1;
      }
      return 0;
    });
    return sortedPairs;
  }, [search, favouritePairs]);

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setSearch("");
  };

  const handleSelect = (pair: TradingPair) => {
    onSelect({
      symbol: pair.symbol,
      address: pair.address,
      lastPrice: pair.lastPrice,
      change24h: pair.change24h,
      change24hValue: pair.change24hValue,
      marketCap: pair.marketCap,
      volume24h: pair.volume24h,
      selectedMarketType: pair.selectedMarketType,
      allMarketType: pair.allMarketType,
      iconUrl: pair.iconUrl,
    });
    setIsOpen(false);
  };

  const handleAddOrRemoveFavourites = (pair: TradingPair) => {
    if (favouritePairs.some((p) => p.address === pair.address)) {
      setFavouritePairs(
        favouritePairs.filter((p) => p.address !== pair.address),
      );
    } else {
      setFavouritePairs([...favouritePairs, pair]);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="flex h-fit w-[23rem] flex-row items-center justify-end rounded-none border-r border-gray-800 px-4 py-3 hover:cursor-pointer hover:bg-gray-800">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex flex-1 cursor-pointer flex-row items-center justify-start gap-3">
            <StarIcon
              className={cn(
                "h-4 w-4 flex-shrink-0",
                favouritePairs.some((p) => p.address === selectedPair.address)
                  ? "fill-yellow-500 text-yellow-500"
                  : "text-gray-500",
              )}
            />
            <Avatar className="flex-shrink-0">
              <AvatarImage
                src={selectedPair.iconUrl}
                alt={selectedPair.symbol}
              />
              <AvatarUnknownFallback />
            </Avatar>
            <h2 className={cn(text.b2(), "whitespace-nowrap text-white")}>
              {selectedPair.symbol}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center justify-end gap-4">
            <span className={cn(text.b4(), "whitespace-nowrap text-gray-600")}>
              ⌘ K
            </span>
            <ChevronDown className="text-white-100 h-3 w-1.25 flex-shrink-0" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="bg-black-800 flex w-[608px] flex-col border border-gray-800 p-0"
      >
        <DropdownHeader className="!p-4">
          <div className="flex w-full flex-row items-center justify-between gap-1.5">
            <SearchInput
              className="w-full p-0"
              value={search}
              onChange={setSearch}
              placeholder="Search by token or address"
            />
            <div
              className="bg-black-700 h-fit w-fit rounded-md p-4.5 text-gray-400 hover:cursor-pointer hover:bg-gray-900 hover:text-gray-500"
              onClick={handleCloseDropdown}
            >
              <XIcon className="h-4 w-4" />
            </div>
          </div>
        </DropdownHeader>
        <DropdownBody className="flex flex-col !p-0 text-gray-400">
          <DataTable
            className={{
              outer: "bg-black-800 h-full overflow-hidden",
              table: {
                headers: {
                  row: "!bg-black-800 border-none hover:!bg-transparent dark:hover:!bg-transparent",
                },
                body: {
                  row: "!border-none hover:cursor-pointer",
                  cell: "!border-none",
                },
              },
            }}
            onSelectRow={handleSelect}
            columns={marketDropdownColumns(
              favouritePairs,
              handleAddOrRemoveFavourites,
            )}
            data={filteredMarketPairs}
          />
        </DropdownBody>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
