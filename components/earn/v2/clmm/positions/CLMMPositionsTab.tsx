import { useMemo, useState } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  CLMMPersonalPositionState,
  CLMMPoolState,
  IPositionWithValue,
  UserPositionWithNFT,
} from "@/lib/hooks/chain/types";
import { PoolInfo } from "../../PoolInfo";
import { Pool } from "../../types";
import { OpenPosition } from "./OpenPosition";
import { PositionItem } from "./PositionItem";

const dummyPositions: IPositionWithValue[] = Array.from(
  { length: 2 },
  () =>
    ({
      publicKey: new PublicKey(0),
      poolId: new PublicKey(0),
      pool: {
        tokenMint0: new PublicKey(0),
        tokenMint1: new PublicKey(0),
        mintDecimals0: 0,
        mintDecimals1: 0,
        tickCurrent: 0,
      } as CLMMPoolState,
      account: {
        nftMint: new PublicKey(0),
        poolId: new PublicKey(0),
        tickLowerIndex: 0,
        tickUpperIndex: 0,
        liquidity: new BN(0),
        feeGrowthInside0LastX64: new BN(0),
        feeGrowthInside1LastX64: new BN(0),
        tokenFeesOwed0: new BN(0),
        tokenFeesOwed1: new BN(0),
      } as CLMMPersonalPositionState,
      nftTokenAccount: new PublicKey(0),
      amount0: 0,
      amount1: 0,
      fees: {
        token0: {
          amount: 0,
          valueUsd: 0,
          amountRaw: new BN(0),
          mint: new PublicKey(0),
          decimals: 0,
          tokenProfile: undefined,
        },
        token1: {
          amount: 0,
          valueUsd: 0,
          amountRaw: new BN(0),
          mint: new PublicKey(0),
          decimals: 0,
          tokenProfile: undefined,
        },
      },
      rewardInfos: [],
      positionValue: 0,
    }) as IPositionWithValue,
);

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
}: CLMMPositionsTabProps) => {
  const [selectedPosition, setSelectedPosition] = useState<{
    position: IPositionWithValue;
    action: PositionAction;
  } | null>(null);

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

  const positionsToDisplay = useMemo(() => {
    if (isLoadingPositions) return dummyPositions;
    if (!positions) return [];
    return positions;
  }, [isLoadingPositions, positions]);

  const handleSelectPosition = (
    position: IPositionWithValue,
    action: PositionAction,
  ) => {
    setSelectedPosition({ position, action });
  };

  return (
    <div className="flex flex-col">
      <PositionTabHeader
        selectedPosition={selectedPosition?.position}
        selectedPool={selectedPool}
        raydium={raydium}
        onBack={() => setSelectedPosition(null)}
      />
      {isLoadingPositions ? (
        <>
          <PositionItem
            position={dummyPositions[0]}
            selectedPool={selectedPool}
            positionIndex={0}
            isLoading={isLoadingPositions}
            onSelectPosition={() => {}}
          />
          <PositionItem
            position={dummyPositions[1]}
            selectedPool={selectedPool}
            positionIndex={1}
            isLoading={isLoadingPositions}
            onSelectPosition={() => {}}
          />
        </>
      ) : (
        positionsToDisplay.map((position, positionIndex) => {
          return (
            <PositionItem
              key={`position-${position.publicKey.toBase58()}`}
              position={position}
              selectedPool={selectedPool}
              positionIndex={positionIndex}
              isLoading={isLoadingPositions}
              onSelectPosition={handleSelectPosition}
            />
          );
        })
      )}
    </div>
  );
};
