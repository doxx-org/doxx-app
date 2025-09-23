import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { TokenList } from "./TokenList";

interface TokenSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tokenProfiles: TokenProfile[];
  onSelectToken: (token: TokenProfile) => void;
}

export const TokenSelectorDialog = ({
  isOpen,
  onOpenChange,
  tokenProfiles,
  onSelectToken,
}: TokenSelectorDialogProps) => {
  const [search, setSearch] = useState("");

  const filteredTokenProfiles = useMemo(
    () =>
      tokenProfiles.filter(
        (token) =>
          token.symbol.toLowerCase().includes(search.toLowerCase()) ||
          token.name.toLowerCase().includes(search.toLowerCase()) ||
          token.address.toLowerCase().includes(search.toLowerCase()),
      ),
    [tokenProfiles, search],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[598px] min-h-[598px] w-[420px] flex-col gap-0 overflow-hidden">
        <DialogHeader className="h-fit border-b border-gray-800 py-7">
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-1 flex-col overflow-hidden px-0">
          {/* Search Input */}
          <div className="shrink-0 px-4 pt-4">
            <div className="bg-black-700 flex items-center gap-2 rounded-2xl p-4">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                id="search-token-selector"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  text.sb2(),
                  "w-full text-left text-gray-700 outline-none placeholder:text-gray-700",
                )}
                placeholder="Search by token or address"
              />
            </div>
          </div>

          {/* Token list */}
          <TokenList
            filteredTokenProfiles={filteredTokenProfiles}
            onSelectToken={onSelectToken}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
