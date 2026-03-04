import { useCallback, useMemo, useState } from "react";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { BN } from "bn.js";
import { toast } from "sonner";
import { DecreasePositionSuccessToast } from "@/components/toast/DecreasePosition";
import {
  IUserCPMMPositionWithValue,
  RawCPMMPoolInfo,
} from "@/lib/hooks/chain/types";
import { normalizeBN } from "@/lib/utils";
import { simplifyErrorMessage } from "@/lib/utils/errors";
import { Pool } from "../../../types";
import { AssetReceive } from "./AssetReceive";
import { DecreaseCPMMPositionButton } from "./DecreaseCPMMPositionButton";
import { RemoveLiquidityPanel } from "./RemoveLiquidityPanel";

interface DecreasePositionProps {
  raydium: Raydium | undefined;
  position: IUserCPMMPositionWithValue;
  selectedPool: Pool;
  poolInfo: RawCPMMPoolInfo | undefined;
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
    // Calculate withdrawal amounts based on percentage
    const withdrawAmountA = position.amount0Raw
      .mul(new BN(removeLiquidityRatio))
      .div(new BN(100));
    const withdrawAmountB = position.amount1Raw
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

    const lpAmount =
      removeLiquidityRatio >= 100
        ? position.lpAmountRaw
        : position.lpAmountRaw
            .mul(new BN(removeLiquidityRatio))
            .div(new BN(100));
    const lpValue = token1Value + token2Value;

    return {
      token1Amount,
      token2Amount,
      token1Value,
      token2Value,
      lpAmount,
      lpValue,
    };
  }, [position, removeLiquidityRatio, selectedPool]);

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
        lpAmount={Number(normalizeBN(amounts.lpAmount, position.lpDecimals))}
        lpValue={amounts.lpValue}
        formatter={{
          decimals: position.lpDecimals ?? 6,
          minimumDecimals: position.lpDecimals ?? 6,
        }}
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
        <DecreaseCPMMPositionButton
          raydium={raydium}
          lpAmount={amounts.lpAmount}
          poolInfo={poolInfo}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>
    </div>
  );
};
