import { CopyIcon } from "lucide-react";
import Image from "next/image";
import { copyToClipboard, text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TokenProfile, ellipseAddress } from "@/utils/tokens";

interface TokenListProps {
  filteredTokenProfiles: TokenProfile[];
  onSelectToken: (token: TokenProfile) => void;
}

export function TokenList({
  filteredTokenProfiles,
  onSelectToken,
}: TokenListProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4">
        <p className={cn(text.sb3(), "text-gray-500")}>All Tokens</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredTokenProfiles.length > 0 ? (
          filteredTokenProfiles.map((token) => (
            <div
              key={token.name}
              onClick={() => onSelectToken(token)}
              className="flex items-center gap-4 px-6 py-4 hover:cursor-pointer hover:bg-gray-800"
            >
              <Image
                src={token.image}
                alt={token.symbol}
                width={32}
                height={32}
                className="rounded-full"
              />

              {/* Token details */}
              <div className="flex flex-col gap-2">
                <p className={cn(text.b3(), "leading-none text-gray-200")}>
                  {token.name}
                </p>
                <div className="flex items-center gap-2 leading-none">
                  <p className={cn(text.sb3(), "text-gray-500")}>
                    {token.symbol}
                  </p>
                  <p className={cn(text.sb3(), "text-gray-600")}>
                    {ellipseAddress(token.address, 6, 4)}
                  </p>
                  <CopyIcon
                    className="h-[11.25px] w-[11.25px] text-gray-600"
                    onClick={() => copyToClipboard(token.address)}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center pt-10">
            <p className={cn(text.sb3(), "text-gray-500")}>No tokens found</p>
          </div>
        )}
      </div>
    </div>
  );
}
