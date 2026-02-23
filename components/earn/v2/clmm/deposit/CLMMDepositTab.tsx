import { useCallback, useEffect, useMemo, useState } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { knownTokenProfiles } from "@/lib/config/tokens";
import { usePrepareOpenCLMMPosition } from "@/lib/hooks/chain/prepare/usePrepareOpenCLMMPosition";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { useAllPrices } from "@/lib/hooks/useAllPrices";
import { text } from "@/lib/text";
import { cn, formatNumber, normalizeBN, parseDecimalsInput } from "@/lib/utils";
import { PoolInfo } from "../../PoolInfo";
import { Pool, PriceMode } from "../../types";
import { DepositCLMMPanel } from "../DepositCLMMPanel";
import { DepositCLMMButton } from "./DepositCLMMButton";
import { DepositRange } from "./DepositRange";

export const CLMMDepositTab = ({
  selectedPool,
  raydium,
  onDepositSuccess,
}: {
  selectedPool: Pool;
  raydium: Raydium | undefined;
  onDepositSuccess: () => void;
}) => {
  const [tokenAAmount, setTokenAAmount] = useState("");
  const [tokenBAmount, setTokenBAmount] = useState("");
  const [baseIn, setBaseIn] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>(PriceMode.FULL);
  const [tokenALoading, setTokenALoading] = useState(false);
  const [tokenBLoading, setTokenBLoading] = useState(false);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

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

  const { data: allPrices } = useAllPrices();

  const depositingInfo = useMemo(() => {
    const totalValue = selectedPool.tvl;
    const estimatedYields = selectedPool.reward24h;

    return {
      totalValue: formatNumber(totalValue),
      estimatedYields: formatNumber(estimatedYields),
    };
  }, [selectedPool]);

  const {
    data: prepareOpenCLMMPositionData,
    isLoading: isLoadingPrepareOpenCLMMPosition,
  } = usePrepareOpenCLMMPosition({
    poolId: selectedPool.poolId,
    baseIn: baseIn,
    baseAmount: baseIn ? tokenAAmount : tokenBAmount,
    baseToken: baseIn
      ? selectedPool.lpToken.token1
      : selectedPool.lpToken.token2,
    priceMode: priceMode,
    minPriceAperB: minPrice,
    maxPriceAperB: maxPrice,
    raydium: raydium,
  });

  const handleAmountAChange = useCallback((value: string) => {
    setTokenAAmount(parseDecimalsInput(value));
    setBaseIn(true);
  }, []);

  const handleAmountBChange = useCallback((value: string) => {
    setTokenBAmount(parseDecimalsInput(value));
    setBaseIn(false);
  }, []);

  const handleDepositSuccess = useCallback(() => {
    setTokenAAmount("");
    setTokenBAmount("");
    refetchAllSplBalances();
    onDepositSuccess();
  }, [refetchAllSplBalances, onDepositSuccess]);

  useEffect(() => {
    if (isLoadingPrepareOpenCLMMPosition) {
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

    if (prepareOpenCLMMPositionData && !isLoadingPrepareOpenCLMMPosition) {
      if (baseIn) {
        setTokenBAmount(
          normalizeBN(
            prepareOpenCLMMPositionData.amountSlippageB.amount,
            selectedPool.lpToken.token2.decimals,
          ),
        );
      } else {
        setTokenAAmount(
          normalizeBN(
            prepareOpenCLMMPositionData.amountSlippageA.amount,
            selectedPool.lpToken.token1.decimals,
          ),
        );
      }
    }
  }, [
    prepareOpenCLMMPositionData,
    isLoadingPrepareOpenCLMMPosition,
    baseIn,
    selectedPool.lpToken.token2.decimals,
    selectedPool.lpToken.token1.decimals,
  ]);

  return (
    // <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <>
      <PoolInfo {...selectedPool} raydium={raydium} />
      <div className="flex min-h-full flex-col">
        <DepositRange
          priceMode={priceMode}
          setPriceMode={setPriceMode}
          currentPrice={selectedPool.priceBperA}
          minPrice={minPrice}
          maxPrice={maxPrice}
          handleMinPriceChange={setMinPrice}
          handleMaxPriceChange={setMaxPrice}
        />
        <div className="flex flex-col py-5">
          <DepositCLMMPanel
            tokenA={selectedPool.lpToken.token1}
            tokenB={selectedPool.lpToken.token2}
            walletBalances={splBalances}
            tokenAPriceUsd={allPrices?.[selectedPool.lpToken.token1.address]}
            tokenBPriceUsd={allPrices?.[selectedPool.lpToken.token2.address]}
            tokenAInput={tokenAAmount}
            tokenBInput={tokenBAmount}
            tokenALoading={tokenALoading}
            tokenBLoading={tokenBLoading}
            onAmountAChange={handleAmountAChange}
            onAmountBChange={handleAmountBChange}
          />
        </div>
        <div className="flex flex-col gap-5 border-t border-dashed border-gray-800 px-4 py-5">
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
            prepareOpenCLMMPositionData={prepareOpenCLMMPositionData}
            baseIn={baseIn}
            priceMode={priceMode}
            minPriceAperB={minPrice}
            maxPriceAperB={maxPrice}
            poolState={selectedPool.clmmPoolState}
            wallet={wallet}
            walletBalances={splBalances}
            onSuccess={handleDepositSuccess}
          />
        </div>
      </div>
    </>
  );
};
