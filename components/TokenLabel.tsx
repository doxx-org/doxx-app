import { ChevronDown } from "lucide-react";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarUnknownFallback } from "./ui/avatar";

interface TokenLabelProps {
  token: TokenProfile | null;
  label: string;
  disableTokenSelect?: boolean;
  onTokenSelect?: () => void;
}

export const TokenLabel = ({
  token,
  label,
  disableTokenSelect = false,
  onTokenSelect,
}: TokenLabelProps) => {
  return (
    <div
      className={cn(
        "flex w-fit max-w-full min-w-27 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-2.5",
        disableTokenSelect
          ? "cursor-not-allowed"
          : "hover:cursor-pointer hover:bg-gray-700/50",
      )}
      onClick={onTokenSelect}
    >
      {token ? (
        <div className="flex min-w-0 flex-row items-center gap-2">
          <div className="flex items-center justify-center rounded-full">
            <Avatar className="z-10 size-8 bg-white/5">
              <AvatarImage src={token.image} alt={token.symbol} />
              <AvatarUnknownFallback className="border-none bg-white/5" />
            </Avatar>
          </div>
          <span className={cn(text.b3(), "truncate text-gray-300")}>
            {token.symbol}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-row items-center gap-2">
          <div className="size-8 rounded-full bg-white/5" />
          <span className={cn(text.b3(), "truncate text-gray-300")}>
            {label}
          </span>
        </div>
      )}
      {!disableTokenSelect && <ChevronDown className="h-4 w-4" />}
    </div>
  );
};
