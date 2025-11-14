import CopyIcon from "@/assets/icons/table/copy.svg";
import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import { copyToClipboard, text } from "@/lib/text";
import { cn, parseDisplayAccount } from "@/lib/utils";
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
            <AvatarImage src={lpToken.token1.image} alt={lpToken.token1.name} />
            <AvatarUnknownFallback />
          </Avatar>
          <Avatar className="size-7">
            <AvatarImage src={lpToken.token2.image} alt={lpToken.token2.name} />
            <AvatarUnknownFallback />
          </Avatar>
        </div>
        <div className="group flex flex-col gap-1">
          <p className="text-left text-gray-200 transition-colors group-hover:text-gray-300">
            {lpToken.token1.name} / {lpToken.token2.name}
          </p>
          <div className="flex flex-row items-center gap-1">
            <p className={cn(text.sb3(), "text-gray-400")}>
              {`${fee}% | ${parseDisplayAccount(account)}`}
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
