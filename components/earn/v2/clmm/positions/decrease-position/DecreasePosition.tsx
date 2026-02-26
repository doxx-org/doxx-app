import { useCallback, useMemo, useState } from "react";
import {
  LiquidityMath,
  Raydium,
  SqrtPriceMath,
} from "@raydium-io/raydium-sdk-v2";
import { BN } from "bn.js";
import { toast } from "sonner";
import { DecreasePositionSuccessToast } from "@/components/toast/DecreasePosition";
import { BPS, DEFAULT_DECREASE_CLMM_SLIPPAGE } from "@/lib/constants";
import { IPositionWithValue, RawPoolInfo } from "@/lib/hooks/chain/types";
import { simplifyErrorMessage } from "@/lib/utils/errors";
import { Pool } from "../../../types";
import { AssetReceive } from "./AssetReceive";
import { DecreaseCLMMPositionButton } from "./DecreaseCLMMPositionButton";
import { RemoveLiquidityPanel } from "./RemoveLiquidityPanel";

interface DecreasePositionProps {
  raydium: Raydium | undefined;
  position: IPositionWithValue;
  selectedPool: Pool;
  poolInfo: RawPoolInfo | undefined;
  onPositionCTASuccess: () => void;
}

export const DecreasePosition = ({
  raydium,
  position,
  selectedPool,
  poolInfo,
  onPositionCTASuccess,
}: DecreasePositionProps) => {
  const [removeLiquidityRatio, setRemoveLiquidityRatio] = useState(25); // 25%

  const amounts = useMemo(() => {
    // Apply a small buffer to min amounts to avoid on-chain slippage check failures
    const decreaseSlippageBps = Math.round(
      DEFAULT_DECREASE_CLMM_SLIPPAGE * BPS,
    );

    const sqrtPriceLower = SqrtPriceMath.getSqrtPriceX64FromTick(
      position.positionLayout.tickLower,
    );
    const sqrtPriceUpper = SqrtPriceMath.getSqrtPriceX64FromTick(
      position.positionLayout.tickUpper,
    );

    const totalAmounts = LiquidityMath.getAmountsFromLiquidity(
      position.pool.sqrtPriceX64,
      sqrtPriceLower,
      sqrtPriceUpper,
      position.positionLayout.liquidity,
      true,
    );

    // Calculate withdrawal amounts based on percentage
    const withdrawAmountA = totalAmounts.amountA
      .mul(new BN(removeLiquidityRatio))
      .div(new BN(100));
    const withdrawAmountB = totalAmounts.amountB
      .mul(new BN(removeLiquidityRatio))
      .div(new BN(100));

    // Convert to human-readable
    const token1Amount =
      Number(withdrawAmountA) /
      Math.pow(10, selectedPool.lpToken.token1.decimals);
    const token2Amount =
      Number(withdrawAmountB) /
      Math.pow(10, selectedPool.lpToken.token2.decimals);

    const token1Price = selectedPool.oraclePriceToken1Usd
      ? selectedPool.oraclePriceToken1Usd
      : selectedPool.priceToken1Usd;
    const token2Price = selectedPool.oraclePriceToken2Usd
      ? selectedPool.oraclePriceToken2Usd
      : selectedPool.priceToken2Usd;

    const token1Value = token1Amount * token1Price;
    const token2Value = token2Amount * token2Price;

    const liquidity = position.positionLayout.liquidity
      .mul(new BN(removeLiquidityRatio))
      .div(new BN(100));

    const amountMinA = withdrawAmountA
      .mul(new BN(BPS - decreaseSlippageBps))
      .div(new BN(BPS));
    const amountMinB = withdrawAmountB
      .mul(new BN(BPS - decreaseSlippageBps))
      .div(new BN(BPS));

    return {
      token1Amount,
      token2Amount,
      token1Value,
      token2Value,
      amountMinA,
      amountMinB,
      liquidity,
    };
  }, [position, removeLiquidityRatio, selectedPool]);

  const isClosePosition = useMemo(() => {
    return removeLiquidityRatio === 100;
  }, [removeLiquidityRatio]);

  const handleSuccess = useCallback(
    (txSignature: string | undefined) => {
      if (txSignature) {
        toast.success(
          <DecreasePositionSuccessToast txSignature={txSignature} />,
        );
      } else {
        toast.success("Decrease position successful!");
      }
      onPositionCTASuccess();
    },
    [onPositionCTASuccess],
  );

  const handleError = useCallback((error: Error) => {
    toast.error(simplifyErrorMessage(error, "Decrease position failed"));
  }, []);

  return (
    <div className="flex flex-col">
      <RemoveLiquidityPanel
        removeLiquidityRatio={removeLiquidityRatio}
        handleAdjustRemoveLiquidityRatio={setRemoveLiquidityRatio}
      />
      <div className="flex flex-col gap-5 px-4 py-6">
        <AssetReceive
          token1={selectedPool.lpToken.token1}
          token2={selectedPool.lpToken.token2}
          token1Amount={amounts.token1Amount}
          token2Amount={amounts.token2Amount}
          token1Value={amounts.token1Value}
          token2Value={amounts.token2Value}
        />
        <DecreaseCLMMPositionButton
          raydium={raydium}
          position={position}
          liquidity={amounts.liquidity}
          amountMinA={amounts.amountMinA}
          amountMinB={amounts.amountMinB}
          isClosePosition={isClosePosition}
          poolInfo={poolInfo}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>
    </div>
  );
};
