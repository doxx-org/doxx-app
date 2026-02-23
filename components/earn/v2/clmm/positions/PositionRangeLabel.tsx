import { useMemo } from "react";
import { CopyIcon } from "lucide-react";
import { Link } from "@/components/Link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { copyToClipboard, text } from "@/lib/text";
import { cn, ellipseAddress } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";

interface PositionRangeLabelProps {
  position: IPositionWithValue;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  isLoading: boolean;
}

export const PositionRangeLabel = ({
  position,
  currentTick,
  tickLower,
  tickUpper,
  isLoading,
}: PositionRangeLabelProps) => {
  const isInRange = useMemo(() => {
    return tickLower <= currentTick && currentTick < tickUpper;
  }, [currentTick, tickLower, tickUpper]);

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
          <div
            className={cn(
              "size-1.25 rounded-full",
              isInRange ? "bg-green" : "bg-orange",
            )}
          />
          {isInRange ? "In Range" : "Out of Range"}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className={cn(text.sb3(), "flex items-center gap-1")}>
          <p>Position:</p>
          <Link
            className={"hover:text-green text-gray-400 hover:cursor-pointer"}
            href={getTokenExplorerUrl(position.publicKey.toString())}
          >
            {ellipseAddress(position.publicKey.toString())}
          </Link>
          <CopyIcon
            className="h-2.5 w-2.5 cursor-pointer"
            onClick={() => copyToClipboard(position.publicKey.toString())}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
