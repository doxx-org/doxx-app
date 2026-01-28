import CopyIcon from "@/assets/icons/table/copy.svg";
import { Link } from "@/components/Link";
import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyToClipboard, text } from "@/lib/text";
import { cn, ellipseAddress, normalizeBPSString } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";
import { Pool } from "../PoolColumn";

type PoolRowProps = {
  pool: Pool;
};

export function PoolRow({ pool }: PoolRowProps) {
  const { lpToken, poolId, fee } = pool;

  return (
    <div className="flex flex-row items-center gap-2">
      <div className="flex flex-row items-center gap-2">
        <div className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-gray-800">
          <Avatar className="z-10 size-7 bg-gray-800">
            <AvatarImage
              src={lpToken.token1.image}
              alt={lpToken.token1.symbol}
            />
            <AvatarUnknownFallback />
          </Avatar>
          <Avatar className="size-7">
            <AvatarImage
              src={lpToken.token2.image}
              alt={lpToken.token2.symbol}
            />
            <AvatarUnknownFallback />
          </Avatar>
        </div>
        <div className="group flex flex-col gap-1">
          <div className="flex flex-row items-center gap-1 text-left text-gray-200 transition-colors">
            <div className="flex flex-row items-center gap-1">
              <Tooltip>
                <TooltipTrigger>
                  <span
                    className={cn(text.b3(), "cursor-help hover:text-gray-300")}
                  >
                    {lpToken.token1.symbol}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Link
                      href={`${getTokenExplorerUrl(lpToken.token1.address.toString())}`}
                      className="hover:text-green"
                    >
                      {ellipseAddress(lpToken.token1.address.toString())}
                    </Link>
                    <CopyIcon
                      className="active: cursor-pointer"
                      onClick={() => {
                        copyToClipboard(lpToken.token1.address.toString());
                      }}
                    />
                  </div>
                </TooltipContent>
              </Tooltip>{" "}
              /{" "}
              <Tooltip>
                <TooltipTrigger>
                  <span
                    className={cn(text.b3(), "cursor-help hover:text-gray-300")}
                  >
                    {lpToken.token2.symbol}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Link
                      href={`${getTokenExplorerUrl(lpToken.token2.address.toString())}`}
                      className="hover:text-green"
                    >
                      {ellipseAddress(lpToken.token2.address.toString())}
                    </Link>
                    <CopyIcon
                      className="active: cursor-pointer"
                      onClick={() => {
                        copyToClipboard(lpToken.token2.address.toString());
                      }}
                    />
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <span
              className={cn(
                text.sb4(),
                "text-green rounded-full bg-gray-900 px-3 py-1.5",
              )}
            >
              {pool.poolType.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-row items-center gap-1 text-gray-400">
            <p className={cn(text.sb3(), "text-green")}>
              {`${normalizeBPSString(fee.toString())}%`}
            </p>
            |
            <Link
              href={`${getTokenExplorerUrl(lpToken.token2.address.toString())}`}
              className={cn(
                text.sb3(),
                "items-center text-gray-400 no-underline hover:text-gray-300",
              )}
            >
              {ellipseAddress(poolId, 5)}
            </Link>
            <CopyIcon
              className="cursor-pointer"
              onClick={() => {
                copyToClipboard(poolId);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
