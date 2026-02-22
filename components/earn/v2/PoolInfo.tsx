import { Raydium } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { TokenPriceDisplay } from "@/components/TokenPriceDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TokenProfile } from "@/lib/config/tokens";
import { copyToClipboard, text } from "@/lib/text";
import { cn, ellipseAddress, normalizeBPSString } from "@/lib/utils";
import { getAddressExplorerUrl } from "@/lib/utils/network";
import { Pool, PoolType } from "./types";

interface PoolDetail2Props {
  token1: TokenProfile;
  token2: TokenProfile;
  tvl: number;
  priceBperA: number;
  reward24h: number;
}

const PoolDetail2 = ({
  tvl,
  priceBperA,
  reward24h,
  token1,
  token2,
}: PoolDetail2Props) => {
  return (
    <div className={cn(text.sb3(), "flex w-full flex-col gap-3 leading-none")}>
      <div className="flex justify-between">
        <p className="text-gray-500">TVL</p>
        <p className="text-gray-200">${tvl}</p>
      </div>
      <div className="flex justify-between">
        <p className="text-gray-500">Current Price</p>
        <div className="flex items-center gap-1">
          <TokenPriceDisplay price={1} token={token1} isLoading={false} />
          <p>=</p>
          <TokenPriceDisplay
            price={priceBperA}
            token={token2}
            isLoading={false}
          />
        </div>
      </div>
      <div className="flex justify-between">
        <p className="text-gray-500">Reward 24h</p>
        <p className="text-gray-200">{reward24h}</p>
      </div>
    </div>
  );
};

interface PoolDetail1Props {
  token1: TokenProfile;
  token2: TokenProfile;
  symbol: string;
  poolType: PoolType;
  address: string;
  fee: BN;
  apr: number;
}

const PoolDetail1 = ({
  token1,
  token2,
  symbol: poolSymbol,
  poolType,
  address,
  fee,
  apr,
}: PoolDetail1Props) => {
  return (
    <div className="bg-black-700 flex w-full items-center justify-between gap-4 rounded-xl p-4">
      {/* Left Side: Img, Symbol, Pool Type, Address, Fee */}
      <div className="flex min-w-0 flex-1 gap-4.5">
        {/* Image */}
        <div className="flex shrink-0 items-center">
          <Avatar className="size-8.5">
            <AvatarImage src={token1.image} alt={token1.symbol} />
            <AvatarFallback>{token1.symbol}</AvatarFallback>
          </Avatar>
          <Avatar className="-ml-2 size-8.5">
            <AvatarImage src={token2.image} alt={token2.symbol} />
            <AvatarFallback>{token2.symbol}</AvatarFallback>
          </Avatar>
        </div>
        {/* Symbol, Pool Type */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1 text-left">
            <p className={cn(text.hsb2(), "truncate leading-5 text-gray-200")}>
              {poolSymbol}
            </p>
            <div
              className={cn(
                text.sb4(),
                "text-green flex h-full shrink-0 items-center rounded-2xl bg-gray-900 px-3",
              )}
            >
              <span className="leading-0">{poolType}</span>
            </div>
          </div>
          <div className={cn(text.sb3(), "flex gap-3 leading-none")}>
            <p className="text-green">{normalizeBPSString(fee.toString())}%</p>
            <div className="border-r border-gray-700" />
            <div className="flex items-center gap-2">
              <a
                className="text-gray-400 hover:cursor-pointer hover:text-gray-300"
                href={getAddressExplorerUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ellipseAddress(address)}
              </a>
              <CopyIcon
                className="h-3 w-3 stroke-gray-400 hover:cursor-pointer hover:stroke-gray-300"
                onClick={() => {
                  copyToClipboard(address);
                  toast.success("Copied to clipboard");
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Right Side: APR */}
      <div
        className={cn(
          text.b3(),
          "bg-green/10 text-green flex shrink-0 gap-1.5 rounded-full px-3 py-2 leading-none",
        )}
      >
        <p>APR</p>
        <p>{apr.toFixed(2)}</p>
        <p>%</p>
      </div>
    </div>
  );
};

export const PoolInfo = ({
  lpToken: { token1, token2 },
  fee,
  poolId,
  apr,
  tvl,
  poolType,
  priceBperA,
  reward24h,
  // raydium,
}: Pool & { raydium: Raydium | undefined }) => {
  return (
    <div className="flex w-full flex-col gap-5 border-b border-gray-800 px-4 py-5">
      <PoolDetail1
        token1={token1}
        token2={token2}
        symbol={`${token1.symbol}/${token2.symbol}`}
        poolType={poolType}
        address={poolId}
        fee={fee}
        apr={apr}
      />
      <PoolDetail2
        tvl={tvl}
        token1={token1}
        token2={token2}
        priceBperA={priceBperA}
        reward24h={reward24h}
      />
    </div>
  );
};
