import { useCallback, useMemo, useState } from "react";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { Pool } from "@/components/earn/v2/types";
import {
  IUserCPMMPositionWithValue,
  UserCPMMPosition,
} from "@/lib/hooks/chain/types";
import { useGetCPMMPoolInfo } from "@/lib/hooks/chain/v2/useGetCPMMPoolInfo";
import { PoolInfo } from "../PoolInfo";
import { OpenPosition } from "../cpmm/positions/OpenPosition";
import { PositionContent } from "./positions/PositionContent";

export enum PositionAction {
  DECREASE,
  INCREASE,
}

interface CPMMPositionsTabProps {
  selectedPool: Pool;
  raydium: Raydium | undefined;
  positions: UserCPMMPosition[] | undefined;
  isLoadingPositions: boolean;
  allPools: Pool[] | undefined;
  onPositionCTASuccess: () => void;
}

const PositionTabHeader = ({
  selectedPosition,
  selectedPool,
  onBack,
}: Pick<CPMMPositionsTabProps, "selectedPool" | "raydium"> & {
  selectedPosition: IUserCPMMPositionWithValue | undefined;
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

  return <PoolInfo {...selectedPool} />;
};

export const CPMMPositionsTab = ({
  selectedPool,
  raydium,
  positions: rawPositions,
  isLoadingPositions,
  allPools,
  onPositionCTASuccess,
}: CPMMPositionsTabProps) => {
  const [selectedPosition, setSelectedPosition] = useState<
    | {
        position: IUserCPMMPositionWithValue;
        action: PositionAction;
      }
    | undefined
  >(undefined);

  const { data: poolInfo, refetch: refetchPoolInfo } = useGetCPMMPoolInfo(
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

  const positions: IUserCPMMPositionWithValue[] = useMemo(() => {
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
    position: IUserCPMMPositionWithValue,
    action: PositionAction,
  ) => {
    setSelectedPosition({ position, action });
  };

  const handlePositionCTASuccess = useCallback(() => {
    onPositionCTASuccess();
    refetchPoolInfo();

    setTimeout(() => {
      setSelectedPosition(undefined);
    }, 1000); // 1 second delay to avoid flashing state
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
