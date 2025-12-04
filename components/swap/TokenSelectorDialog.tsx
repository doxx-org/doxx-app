import { useMemo, useState } from "react";
import { TokenProfile } from "@/lib/config/tokens";
import { SearchInput } from "../SearchInput";
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

  const filteredTokenProfiles: TokenProfile[] | undefined = useMemo(
    () =>
      tokenProfiles.filter(
        (token: TokenProfile) =>
          token.symbol?.toLowerCase().includes(search.toLowerCase()) ||
          token.name?.toLowerCase().includes(search.toLowerCase()) ||
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
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by token or address"
          />

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
