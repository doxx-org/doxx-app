import { useMemo, useState } from "react";
import { LiquidityMath, SqrtPriceMath } from "@raydium-io/raydium-sdk-v2";
import { BN } from "bn.js";
import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { Pool } from "../../../types";
import { AssetReceive } from "./AssetReceive";
import { RemoveLiquidityPanel } from "./RemoveLiquidityPanel";

interface DecreasePositionProps {
  position: IPositionWithValue;
  selectedPool: Pool;
}

export const DecreasePosition = ({
  position,
  selectedPool,
}: DecreasePositionProps) => {
  const [removeLiquidityRatio, setRemoveLiquidityRatio] = useState(25); // 25%

  const amounts = useMemo(() => {
    const sqrtPriceLower = SqrtPriceMath.getSqrtPriceX64FromTick(
      position.account.tickLowerIndex,
    );
    const sqrtPriceUpper = SqrtPriceMath.getSqrtPriceX64FromTick(
      position.account.tickUpperIndex,
    );

    const totalAmounts = LiquidityMath.getAmountsFromLiquidity(
      position.pool.sqrtPriceX64,
      sqrtPriceLower,
      sqrtPriceUpper,
      position.account.liquidity,
      false,
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

    return {
      token1Amount,
      token2Amount,
      token1Value,
      token2Value,
    };
  }, [position, removeLiquidityRatio, selectedPool]);

  return (
    <div className="flex flex-col">
      <RemoveLiquidityPanel
        removeLiquidityRatio={removeLiquidityRatio}
        handleAdjustRemoveLiquidityRatio={setRemoveLiquidityRatio}
      />
      <AssetReceive
        token1={selectedPool.lpToken.token1}
        token2={selectedPool.lpToken.token2}
        token1Amount={amounts.token1Amount}
        token2Amount={amounts.token2Amount}
        token1Value={amounts.token1Value}
        token2Value={amounts.token2Value}
      />
    </div>
  );
};
