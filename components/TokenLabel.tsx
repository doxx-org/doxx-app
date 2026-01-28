import { ChevronDown } from "lucide-react";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn, ellipseAddress } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarUnknownFallback } from "./ui/avatar";

interface TokenLabelProps {
  token: TokenProfile | null;
  label: string;
  address?: string;
  disableTokenSelect?: boolean;
  onTokenSelect?: () => void;
  className?: string;
  tokenClassName?: string;
}

export const TokenLabel = ({
  token,
  label,
  address,
  disableTokenSelect = false,
  onTokenSelect,
  className,
  tokenClassName,
}: TokenLabelProps) => {
  return (
    <div
      className={cn(
        "flex w-fit max-w-full min-w-27 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-2.5",
        disableTokenSelect
          ? "cursor-not-allowed"
          : "hover:cursor-pointer hover:bg-gray-700/50",
        className,
      )}
      onClick={onTokenSelect}
    >
      {token ? (
        <div
          className={cn(
            "flex min-w-0 flex-row items-center gap-2",
            tokenClassName,
          )}
        >
          <div className="flex items-center justify-center rounded-full">
            <Avatar className="z-10 size-8 bg-white/5">
              <AvatarImage src={token.image} alt={token.symbol} />
              <AvatarUnknownFallback className="border-none bg-white/5" />
            </Avatar>
          </div>
          {address ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className={cn(text.b2(), "truncate text-gray-200")}>
                {token.symbol}
              </span>
              <span className={cn(text.sb3(), "text-gray-400")}>
                {ellipseAddress(address, 6, 4)}
              </span>
            </div>
          ) : (
            <span className={cn(text.b3(), "truncate text-gray-300")}>
              {token.symbol}
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex min-w-0 flex-row items-center gap-2",
            tokenClassName,
          )}
        >
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
