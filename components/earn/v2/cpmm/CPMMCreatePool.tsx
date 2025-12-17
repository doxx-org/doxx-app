import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { knownTokenProfiles, solayer, usdc } from "@/lib/config/tokens";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { usePrices } from "@/lib/hooks/usePrices";
import { text } from "@/lib/text";
import { cn, formatNumber } from "@/lib/utils";
import { Pool } from "../../PoolColumn";
import { DepositPanel } from "../DepositPanel";
import { PoolInfo } from "../PoolInfo";
import { PoolType } from "../types";

const defaultCPMMPool = {
  symbol: "LAYER/USDC",
  token0: solayer,
  token1: usdc,
  fee: 0.03,
  address: "0x0000000000000000000000000000000000000000",
  apr: 0.0,
  poolType: PoolType.CPMM,
  tvl: 10239410.21,
  currentPrice: 0.301,
  reward24h: 0.0001,
};

export const CPMMCreatePool = ({ selectedPool }: { selectedPool: Pool }) => {
  const [tokenA, setTokenA] = useState(selectedPool.lpToken.token1);
  const [tokenB, setTokenB] = useState(selectedPool.lpToken.token2);
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
      <div className="flex flex-col py-6">
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
      <div className="flex h-full flex-col justify-between border-t border-dashed border-gray-800 px-4 py-6">
        <div className={cn(text.sb3(), "flex flex-col gap-3")}>
          <div className="flex justify-between">
            <p className="text-gray-500">Total Value</p>
            <p className="text-gray-200">${depositingInfo.totalValue}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-gray-600">Estimated Yields</p>
            <p className="text-gray-200">${depositingInfo.estimatedYields}</p>
          </div>
        </div>
        <Button className={cn("text-green")}>Deposit</Button>
      </div>
    </div>
  );
};
