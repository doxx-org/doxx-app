import { CopyIcon } from "lucide-react";
import { Link } from "@/components/Link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserCPMMPosition } from "@/lib/hooks/chain/useGetUserCpmmPositions";
import { copyToClipboard, text } from "@/lib/text";
import { cn, ellipseAddress } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";

interface PositionRangeLabelProps {
  position: UserCPMMPosition;
  isLoading: boolean;
}

export const PositionRangeLabel = ({
  position,
  isLoading,
}: PositionRangeLabelProps) => {
  if (isLoading) {
    return <Skeleton className="h-4 w-20" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={cn(
            text.sb4(),
            "bg-green/10 hover:bg-green/20 flex items-center gap-2 rounded-sm px-2 py-1.5",
          )}
        >
          <div className={cn("size-1.25 rounded-full", "bg-green")} />
          {"Full Range"}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className={cn(text.sb3(), "flex items-center gap-1")}>
          <p>Position:</p>
          <Link
            className={"hover:text-green text-gray-400 hover:cursor-pointer"}
            href={getTokenExplorerUrl(position.lpMint.toString())}
          >
            {ellipseAddress(position.lpMint.toString())}
          </Link>
          <CopyIcon
            className="h-2.5 w-2.5 cursor-pointer"
            onClick={() => copyToClipboard(position.lpMint.toString())}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
