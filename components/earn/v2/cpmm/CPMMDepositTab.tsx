import { useCallback, useEffect, useMemo, useState } from "react";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { knownTokenProfiles } from "@/lib/config/tokens";
import { CPMMPoolState } from "@/lib/hooks/chain/types";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { usePrepareOpenCPMMPosition } from "@/lib/hooks/chain/v2/usePrepareOpenCPMMPosition";
import { useAllPrices } from "@/lib/hooks/useAllPrices";
import { text } from "@/lib/text";
import { cn, formatNumber, normalizeBN, parseDecimalsInput } from "@/lib/utils";
import { DepositPanel } from "../DepositPanel";
import { PoolInfo } from "../PoolInfo";
import { Pool } from "../types";
import { DepositCPMMButton } from "./DepositCPMMButton";

interface CPMMPositionsTabProps {
  selectedPool: Pool;
  raydium: Raydium | undefined;
  onDepositSuccess: () => void;
}

export const CPMMDepositTab = ({
  selectedPool,
  raydium,
  onDepositSuccess,
}: CPMMPositionsTabProps) => {
  const [tokenAAmount, setTokenAAmount] = useState("");
  const [tokenBAmount, setTokenBAmount] = useState("");
  const [baseIn, setBaseIn] = useState(true);
  const [lpAmount, setLpAmount] = useState("");
  const [tokenALoading, setTokenALoading] = useState(false);
  const [tokenBLoading, setTokenBLoading] = useState(false);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxCpmmProgram({ provider });

  // Fetch token balances
  const { data: splBalances, refetch: refetchAllSplBalances } =
    useAllSplBalances(
      connection,
      wallet?.publicKey ?? undefined,
      knownTokenProfiles,
      true,
      {
        includeToken2022: true,
      },
    );

  const { data: prices } = useAllPrices();

  const {
    data: prepareOpenCPMMPositionData,
    isLoading: isLoadingPrepareOpenCPMMPosition,
  } = usePrepareOpenCPMMPosition({
    poolId: selectedPool.poolId,
    baseIn: baseIn,
    baseUiAmount: baseIn ? tokenAAmount : tokenBAmount,
    baseToken: baseIn
      ? selectedPool.lpToken.token1
      : selectedPool.lpToken.token2,
    raydium,
  });

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
    setBaseIn(true);
  }, []);

  const handleAmountBChange = useCallback((value: string) => {
    setTokenBAmount(parseDecimalsInput(value));
    setBaseIn(false);
  }, []);

  const handleAmountLpChange = useCallback((value: string) => {
    setLpAmount(parseDecimalsInput(value));
  }, []);

  const handleDepositSuccess = useCallback(() => {
    setTokenAAmount("");
    setTokenBAmount("");
    setLpAmount("");
    refetchAllSplBalances();
    onDepositSuccess();
  }, [refetchAllSplBalances, onDepositSuccess]);

  useEffect(() => {
    if (isLoadingPrepareOpenCPMMPosition) {
      if (baseIn) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTokenBLoading(true);
      } else {
        setTokenALoading(true);
      }
      return;
    }

    setTokenBLoading(false);

    setTokenALoading(false);

    if (prepareOpenCPMMPositionData && !isLoadingPrepareOpenCPMMPosition) {
      if (baseIn) {
        setTokenBAmount(
          normalizeBN(
            prepareOpenCPMMPositionData.anotherAmount.amount,
            selectedPool.lpToken.token2.decimals,
          ),
        );
      } else {
        setTokenAAmount(
          normalizeBN(
            prepareOpenCPMMPositionData.anotherAmount.amount,
            selectedPool.lpToken.token1.decimals,
          ),
        );
      }
    }
  }, [
    prepareOpenCPMMPositionData,
    isLoadingPrepareOpenCPMMPosition,
    baseIn,
    selectedPool.lpToken.token2.decimals,
    selectedPool.lpToken.token1.decimals,
  ]);

  return (
    <>
      <PoolInfo {...selectedPool} />
      <div className="flex flex-col justify-between">
        <div className="flex flex-col py-5">
          <DepositPanel
            tokenA={selectedPool.lpToken.token1}
            tokenB={selectedPool.lpToken.token2}
            lpTokenMint={selectedPool.cpmmPoolState!.lpMint.toString()}
            walletBalances={splBalances}
            priceMap={prices}
            tokenAInput={tokenAAmount}
            tokenBInput={tokenBAmount}
            tokenALoading={tokenALoading}
            tokenBLoading={tokenBLoading}
            onAmountAChange={handleAmountAChange}
            onAmountBChange={handleAmountBChange}
            onAmountLPChange={handleAmountLpChange}
          />
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-dashed border-gray-800 px-4 py-5">
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
          <DepositCPMMButton
            prepareOpenCPMMPositionData={prepareOpenCPMMPositionData}
            raydium={raydium}
            baseIn={baseIn}
            poolId={selectedPool.poolId}
            tokenA={selectedPool.lpToken.token1}
            tokenB={selectedPool.lpToken.token2}
            tokenAAmount={tokenAAmount}
            tokenBAmount={tokenBAmount}
            lpTokenAmount={lpAmount}
            poolState={selectedPool.cpmmPoolState as CPMMPoolState}
            wallet={wallet}
            walletBalances={splBalances}
            doxxAmmProgram={doxxAmmProgram}
            onSuccess={handleDepositSuccess}
          />
        </div>
      </div>
    </>
  );
};
