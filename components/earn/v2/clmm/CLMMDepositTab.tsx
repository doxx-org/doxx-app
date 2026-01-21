import { useCallback, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { knownTokenProfiles } from "@/lib/config/tokens";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { usePrices } from "@/lib/hooks/usePrices";
import { text } from "@/lib/text";
import { cn, formatNumber, parseDecimalsInput } from "@/lib/utils";
import { Pool } from "../../PoolColumn";
import { DepositPanel } from "../DepositPanel";
import { DepositCLMMButton } from "./DepositCLMMButton";

export const CLMMDepositTab = ({ selectedPool }: { selectedPool: Pool }) => {
  const [tokenAAmount, setTokenAAmount] = useState("");
  const [tokenBAmount, setTokenBAmount] = useState("");
  const [lpAmount, setLpAmount] = useState("");

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });

  // Fetch token balances
  const { data: splBalances, refetch: refetchAllSplBalances } =
    useAllSplBalances(
      connection,
      wallet?.publicKey ?? undefined,
      knownTokenProfiles,
      true,
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

  const handleAmountAChange = useCallback((value: string) => {
    setTokenAAmount(parseDecimalsInput(value));
  }, []);

  const handleAmountBChange = useCallback((value: string) => {
    setTokenBAmount(parseDecimalsInput(value));
  }, []);

  const handleAmountLpChange = useCallback((value: string) => {
    setLpAmount(parseDecimalsInput(value));
  }, []);

  const handleDepositSuccess = useCallback(() => {
    setTokenAAmount("");
    setTokenBAmount("");
    setLpAmount("");
    refetchAllSplBalances();
  }, [refetchAllSplBalances]);

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col py-5">
        <DepositPanel
          tokenA={selectedPool.lpToken.token1}
          tokenB={selectedPool.lpToken.token2}
          lpTokenMint={selectedPool.poolState.lpMint.toString()}
          walletBalances={splBalances}
          priceMap={prices}
          tokenAInput={tokenAAmount}
          tokenBInput={tokenBAmount}
          onAmountAChange={handleAmountAChange}
          onAmountBChange={handleAmountBChange}
          onAmountLPChange={handleAmountLpChange}
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
        <DepositCLMMButton
          poolId={selectedPool.poolId}
          tokenA={selectedPool.lpToken.token1}
          tokenB={selectedPool.lpToken.token2}
          tokenAAmount={tokenAAmount}
          tokenBAmount={tokenBAmount}
          lpTokenAmount={lpAmount}
          poolState={selectedPool.poolState}
          wallet={wallet}
          walletBalances={splBalances}
          doxxAmmProgram={doxxAmmProgram}
          onSuccess={handleDepositSuccess}
        />
      </div>
    </div>
  );
};
