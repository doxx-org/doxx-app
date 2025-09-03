import Link from "next/link";
import { toast } from "sonner";
import CopyIcon from "@/assets/icons/table/copy.svg";
import DollarIcon from "@/assets/icons/table/dollar.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { text } from "@/lib/text";
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
            <AvatarFallback>
              <DollarIcon className="opacity-10" />
            </AvatarFallback>
          </Avatar>
          <Avatar className="size-7">
            <AvatarImage src={lpToken.token2.image} alt={lpToken.token2.name} />
            <AvatarFallback>
              <DollarIcon className="opacity-10" />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="group flex flex-col gap-1">
          <Link href={`/deposit/${account}`}>
            <p className="text-left text-gray-200 transition-colors group-hover:text-gray-300">
              {lpToken.token1.name} / {lpToken.token2.name}
            </p>
          </Link>
          <div className="flex flex-row items-center gap-1">
            <p className={cn(text.sb3(), "text-gray-400")}>
              {`${fee}% | ${parseDisplayAccount(account)}`}
            </p>
            <CopyIcon
              onClick={() => {
                navigator.clipboard.writeText(account);
                toast.success("Copied to clipboard");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
