import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { knownTokenProfiles } from "@/lib/config/tokens";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { usePrices } from "@/lib/hooks/usePrices";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { Pool } from "../../PoolColumn";
import { DepositPanel } from "../DepositPanel";

export const CPMMDepositTab = ({ selectedPool }: { selectedPool: Pool }) => {
  const [_tokenA, _setTokenA] = useState(selectedPool.lpToken.token1);
  const [_tokenB, _setTokenB] = useState(selectedPool.lpToken.token2);
  const [tokenAAmount, setTokenAAmount] = useState("");
  const [tokenBAmount, setTokenBAmount] = useState("");

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Fetch token balances
  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    knownTokenProfiles,
  );

  const { data: prices } = usePrices();

  const depositingInfo = useMemo(() => {
    const totalValue = selectedPool.tvl;
    const estimatedYields = selectedPool.reward24h;

    return {
      totalValue: formatNumber(totalValue),
      estimatedYields: formatNumber(estimatedYields),
    };
  }, [selectedPool]);

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col py-5">
        <DepositPanel
          tokenA={selectedPool.lpToken.token1}
          tokenB={selectedPool.lpToken.token2}
          walletBalances={splBalances}
          priceMap={prices}
          tokenAInput={tokenAAmount}
          tokenBInput={tokenBAmount}
          onAmountAChange={setTokenAAmount}
          onAmountBChange={setTokenBAmount}
        />
      </div>
      <div className="flex h-full flex-col justify-between border-t border-dashed border-gray-800 px-4 py-5">
        <div className={cn(text.sb3(), "flex flex-col gap-3 leading-none")}>
          <div className="flex justify-between">
            <p className="text-gray-500">Total Value</p>
            <p className="text-gray-200">${depositingInfo.totalValue}</p>
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <p className="text-gray-600">Estimated Yields</p>
              <span
                className={cn(
                  text.sb4(),
                  "text-green rounded-full bg-gray-900 px-3 py-1.5",
                )}
              >
                1Y
              </span>
            </div>
            <p className="text-gray-200">${depositingInfo.estimatedYields}</p>
          </div>
        </div>
        <Button className={cn(text.hsb1(), "text-green h-13 py-6")}>
          Deposit
        </Button>
      </div>
    </div>
  );
};
