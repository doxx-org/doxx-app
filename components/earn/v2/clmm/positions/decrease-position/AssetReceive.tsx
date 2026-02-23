import { TokenAmount, TokenAmountTooltip } from "@/components/TokenAmount";
import { TokenProfile } from "@/lib/config/tokens";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

interface AssetReceiveProps {
  token1: TokenProfile;
  token2: TokenProfile;
  token1Amount: number;
  token2Amount: number;
  token1Value: number;
  token2Value: number;
}

export const AssetReceive = ({
  token1,
  token2,
  token1Amount,
  token2Amount,
  token1Value,
  token2Value,
}: AssetReceiveProps) => {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <p className={cn(text.b4(), "text-white")}>You will receive</p>
      <div className="flex w-full items-center justify-between">
        <p className={cn(text.sb3(), "text-gray-500")}>Pooled Assets</p>
        <div className="flex gap-1">
          <TokenAmountTooltip
            token={token1}
            amount={token1Amount}
            value={token1Value}
            isLoading={false}
            formatter={{
              decimals: token1.displayDecimals,
              minimumDecimals: token1.displayDecimals,
            }}
            displaySymbol
          />
          {"+"}
          <TokenAmountTooltip
            token={token2}
            amount={token2Amount}
            value={token2Value}
            isLoading={false}
            formatter={{
              decimals: token2.displayDecimals,
              minimumDecimals: token2.displayDecimals,
            }}
            displaySymbol
          />
        </div>
      </div>
    </div>
  );
};
