import { CopyIcon } from "lucide-react";
import { TokenProfile } from "@/lib/config/tokens";
import { copyToClipboard, text } from "@/lib/text";
import { NumberFormatter, cn, ellipseAddress, formatNumber } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";
import { Link } from "./Link";
import { Avatar, AvatarImage, AvatarUnknownFallback } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface TokenAmountProps {
  token: TokenProfile | undefined;
  amount: number;
  isLoading: boolean;
  displaySymbol?: boolean;
  formatter?: NumberFormatter;
}

export const TokenAmount = ({
  token,
  amount,
  isLoading,
  formatter,
  displaySymbol = false,
}: TokenAmountProps) => {
  if (isLoading) {
    return <Skeleton className="h-4 w-10" />;
  }

  return (
    <div
      className={cn(
        text.sb3(),
        "flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-gray-200",
      )}
    >
      <Avatar className="size-3.5 bg-gray-700">
        <AvatarImage src={token?.image} alt={token?.symbol} />
        <AvatarUnknownFallback className="border-none bg-gray-700" />
      </Avatar>
      <p>{formatNumber(amount, formatter)}</p>
      {displaySymbol && <p>{token?.symbol}</p>}
    </div>
  );
};

export const TokenAmountTooltip = ({
  amount,
  value,
  token,
  isLoading,
  formatter,
  displaySymbol = false,
}: TokenAmountProps & { value: number | undefined }) => {
  if (!token)
    return (
      <TokenAmount
        token={token}
        amount={amount}
        isLoading={isLoading}
        formatter={formatter}
        displaySymbol={displaySymbol}
      />
    );

  return (
    <Tooltip>
      <TooltipTrigger>
        <TokenAmount
          token={token}
          amount={amount}
          isLoading={isLoading}
          formatter={formatter}
          displaySymbol={displaySymbol}
        />
      </TooltipTrigger>
      <TooltipContent>
        <div className={cn(text.sb3(), "flex flex-col gap-1")}>
          <div className="flex items-center gap-1">
            <p>Symbol:</p>
            <p className={"text-gray-400"}>{token.symbol}</p>
          </div>
          <div className="flex items-center gap-1">
            <p>Value ($):</p>
            <p className={"text-gray-400"}>
              ${value !== undefined ? formatNumber(value, formatter) : "-"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <p>Address:</p>
            <Link
              className={"hover:text-green text-gray-400 hover:cursor-pointer"}
              href={getTokenExplorerUrl(token.address.toString())}
            >
              {ellipseAddress(token.address.toString())}
            </Link>
            <CopyIcon
              className="h-2.5 w-2.5 cursor-pointer"
              onClick={() => copyToClipboard(token.address.toString())}
            />
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
