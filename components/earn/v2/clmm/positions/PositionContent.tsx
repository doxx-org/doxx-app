import { useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  CLMMPersonalPositionState,
  CLMMPoolState,
  IPositionWithValue,
} from "@/lib/hooks/chain/types";
import { Pool } from "../../types";
import { PositionAction } from "./CLMMPositionsTab";
import { IncreasePosition } from "./IncreasePosition";
import { PositionItem } from "./PositionItem";
import { DecreasePosition } from "./decrease-position/DecreasePosition";

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

interface PositionContentProps {
  isLoadingPositions: boolean;
  positions: IPositionWithValue[];
  selectedPool: Pool;
  selectedPosition:
    | {
        position: IPositionWithValue;
        action: PositionAction;
      }
    | undefined;
  handleSelectPosition: (
    position: IPositionWithValue,
    action: PositionAction,
  ) => void;
}

export const PositionContent = ({
  isLoadingPositions,
  positions,
  selectedPool,
  selectedPosition,
  handleSelectPosition,
}: PositionContentProps) => {
  const positionsToDisplay = useMemo(() => {
    if (isLoadingPositions) return dummyPositions;
    if (!positions) return [];
    return positions;
  }, [isLoadingPositions, positions]);

  if (selectedPosition) {
    if (selectedPosition.action === PositionAction.DECREASE) {
      return (
        <DecreasePosition
          position={selectedPosition.position}
          selectedPool={selectedPool}
        />
      );
    } else {
      return (
        <IncreasePosition
          position={selectedPosition.position}
          selectedPool={selectedPool}
        />
      );
    }
  }

  return isLoadingPositions ? (
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
  );
};
