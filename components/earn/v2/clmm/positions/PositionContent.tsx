import { useMemo } from "react";
import { ClmmPositionLayout, Raydium } from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  CLMMPoolState,
  IPositionWithValue,
  RawPoolInfo,
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
      positionLayout: {
        bump: 0,
        poolId: new PublicKey(0),
        tickLower: 0,
        tickUpper: 0,
        liquidity: new BN(0),
        feeGrowthInsideLastX64A: new BN(0),
        feeGrowthInsideLastX64B: new BN(0),
        tokenFeesOwedA: new BN(0),
        tokenFeesOwedB: new BN(0),
      } as ClmmPositionLayout,
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
  raydium: Raydium | undefined;
  isLoadingPositions: boolean;
  positions: IPositionWithValue[];
  selectedPool: Pool;
  selectedPosition:
    | {
        position: IPositionWithValue;
        action: PositionAction;
      }
    | undefined;
  onSelectPosition: (
    position: IPositionWithValue,
    action: PositionAction,
  ) => void;
  poolInfo: RawPoolInfo | undefined;
  onPositionCTASuccess: () => void;
}

export const PositionContent = ({
  raydium,
  isLoadingPositions,
  positions,
  selectedPool,
  selectedPosition,
  poolInfo,
  onSelectPosition,
  onPositionCTASuccess,
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
          raydium={raydium}
          poolInfo={poolInfo}
          onPositionCTASuccess={onPositionCTASuccess}
        />
      );
    } else {
      return (
        <IncreasePosition
          position={selectedPosition.position}
          selectedPool={selectedPool}
          raydium={raydium}
          poolInfo={poolInfo}
          onPositionCTASuccess={onPositionCTASuccess}
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
          key={`position-${position.positionLayout.nftMint.toBase58()}`}
          position={position}
          selectedPool={selectedPool}
          positionIndex={positionIndex}
          isLoading={isLoadingPositions}
          onSelectPosition={onSelectPosition}
        />
      );
    })
  );
};
