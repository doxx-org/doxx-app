import { useCallback, useMemo, useState } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import {
  IPositionWithValue,
  UserPositionWithNFT,
} from "@/lib/hooks/chain/types";
import { useGetPoolInfo } from "@/lib/hooks/chain/v2/useGetPoolInfo";
import { PoolInfo } from "../../PoolInfo";
import { Pool } from "../../types";
import { OpenPosition } from "./OpenPosition";
import { PositionContent } from "./PositionContent";

export enum PositionAction {
  DECREASE,
  INCREASE,
}

interface CLMMPositionsTabProps {
  selectedPool: Pool;
  raydium: Raydium | undefined;
  positions: UserPositionWithNFT[] | undefined;
  isLoadingPositions: boolean;
  allPools: Pool[] | undefined;
  onPositionCTASuccess: () => void;
}

const PositionTabHeader = ({
  selectedPosition,
  selectedPool,
  raydium,
  onBack,
}: Pick<CLMMPositionsTabProps, "selectedPool" | "raydium"> & {
  selectedPosition: IPositionWithValue | undefined;
  onBack: () => void;
}) => {
  if (selectedPosition) {
    return (
      <OpenPosition
        position={selectedPosition}
        selectedPool={selectedPool}
        onBack={onBack}
      />
    );
  }

  return <PoolInfo {...selectedPool} raydium={raydium} />;
};

export const CLMMPositionsTab = ({
  selectedPool,
  raydium,
  positions: rawPositions,
  isLoadingPositions,
  allPools,
  onPositionCTASuccess,
}: CLMMPositionsTabProps) => {
  const [selectedPosition, setSelectedPosition] = useState<
    | {
        position: IPositionWithValue;
        action: PositionAction;
      }
    | undefined
  >(undefined);

  const { data: poolInfo, refetch: refetchPoolInfo } = useGetPoolInfo(
    raydium,
    selectedPool.poolId,
  );

  const poolPrices: Record<string, number> | undefined = useMemo(() => {
    return allPools?.reduce(
      (acc, p) => {
        if (p.oraclePriceToken1Usd) {
          acc[p.lpToken.token1.address.toLowerCase()] = p.oraclePriceToken1Usd;
        } else {
          acc[p.lpToken.token1.address.toLowerCase()] = p.priceToken1Usd;
        }
        if (p.oraclePriceToken2Usd) {
          acc[p.lpToken.token2.address.toLowerCase()] = p.oraclePriceToken2Usd;
        } else {
          acc[p.lpToken.token2.address.toLowerCase()] = p.priceToken2Usd;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [allPools]);

  const positions: IPositionWithValue[] = useMemo(() => {
    if (!rawPositions) return [];

    const filteredPositions = rawPositions
      .filter(
        (position) =>
          position.poolId.toBase58().toLowerCase() ===
          selectedPool.poolId.toLowerCase(),
      )
      .filter((p) => p !== undefined);

    return filteredPositions.map((c) => {
      const tokenAValue =
        c.amount0 *
        (poolPrices?.[selectedPool.lpToken.token1.address.toLowerCase()] ?? 0);
      const tokenBValue =
        c.amount1 *
        (poolPrices?.[selectedPool.lpToken.token2.address.toLowerCase()] ?? 0);
      const positionValue = tokenAValue + tokenBValue;
      return { ...c, positionValue };
    });
  }, [rawPositions, selectedPool, poolPrices]);

  const handleSelectPosition = (
    position: IPositionWithValue,
    action: PositionAction,
  ) => {
    setSelectedPosition({ position, action });
  };

  const handlePositionCTASuccess = useCallback(() => {
    onPositionCTASuccess();
    refetchPoolInfo();
  }, [refetchPoolInfo, onPositionCTASuccess]);

  return (
    <div className="flex flex-col">
      <PositionTabHeader
        selectedPosition={selectedPosition?.position}
        selectedPool={selectedPool}
        raydium={raydium}
        onBack={() => setSelectedPosition(undefined)}
      />
      <PositionContent
        isLoadingPositions={isLoadingPositions}
        positions={positions}
        selectedPool={selectedPool}
        onSelectPosition={handleSelectPosition}
        selectedPosition={selectedPosition}
        poolInfo={poolInfo}
        raydium={raydium}
        onPositionCTASuccess={handlePositionCTASuccess}
      />
    </div>
  );
};
