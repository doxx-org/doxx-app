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
import { cn, ellipseAddress } from "@/lib/utils";
import { getTokenExplorerUrl } from "@/lib/utils/network";
import { Pool } from "../PoolColumn";

type PoolRowProps = {
  pool: Pool;
};

export function PoolRow({ pool }: PoolRowProps) {
  const { lpToken, account, fee } = pool;

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
          <p className="text-left text-gray-200 transition-colors">
            <Tooltip>
              <TooltipTrigger>
                <span className="cursor-help hover:text-gray-300">
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
                <span className="cursor-help hover:text-gray-300">
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
          </p>
          <div className="flex flex-row items-center gap-1">
            <p className={cn(text.sb3(), "text-gray-400")}>
              {`${fee}% | ${ellipseAddress(account, 5)}`}
            </p>
            <CopyIcon
              className="cursor-pointer"
              onClick={() => {
                copyToClipboard(account);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
