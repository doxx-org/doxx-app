import { useMemo } from "react";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  IUserCPMMPositionWithValue,
  RawCPMMPoolInfo,
} from "@/lib/hooks/chain/types";
// import { IncreasePosition } from "../../cpmm/positions/IncreasePosition";
import { PositionItem } from "../../cpmm/positions/PositionItem";
// import { DecreasePosition } from "../../cpmm/positions/decrease-position/DecreasePosition";
import { Pool, PoolType } from "../../types";
import { PositionAction } from "../CPMMPositionsTab";
import { IncreasePosition } from "./IncreasePosition";
import { DecreasePosition } from "./decrease-position/DecreasePosition";

const dummyTokenProfile = {
  name: "",
  address: PublicKey.default.toBase58(),
  symbol: "",
  decimals: 6,
  displayDecimals: 2,
};

const dummyFeeEntry = {
  amount: 0,
  valueUsd: 0,
  amountRaw: new BN(0),
  mint: PublicKey.default,
  decimals: 6,
  tokenProfile: undefined,
};

const dummyPool: Pool = {
  poolId: PublicKey.default.toBase58(),
  fee: new BN(0),
  lpToken: {
    token1: dummyTokenProfile,
    token2: dummyTokenProfile,
  },
  apr: 0,
  tvl: 0,
  dailyVol: 0,
  dailyVolperTvl: 0,
  reward24h: 0,
  priceBperA: 0,
  priceAperB: 0,
  priceToken1Usd: 0,
  priceToken2Usd: 0,
  poolType: PoolType.CPMM,
};

const dummyPosition: IUserCPMMPositionWithValue = {
  poolId: PublicKey.default,
  pool: dummyPool,
  rpcData: {} as IUserCPMMPositionWithValue["rpcData"],
  lpMint: PublicKey.default,
  lpTokenAccount: PublicKey.default,
  lpAmountRaw: new BN(0),
  lpDecimals: 6,
  userShare: 0,
  amount0: 0,
  amount1: 0,
  amount0Raw: new BN(0),
  amount1Raw: new BN(0),
  fees: {
    token0: dummyFeeEntry,
    token1: dummyFeeEntry,
  },
  rewardInfos: [],
  positionValue: 0,
};

const dummyPositions: IUserCPMMPositionWithValue[] = Array.from(
  { length: 2 },
  () => dummyPosition,
);

interface PositionContentProps {
  raydium: Raydium | undefined;
  isLoadingPositions: boolean;
  positions: IUserCPMMPositionWithValue[];
  selectedPool: Pool;
  selectedPosition:
    | {
        position: IUserCPMMPositionWithValue;
        action: PositionAction;
      }
    | undefined;
  onSelectPosition: (
    position: IUserCPMMPositionWithValue,
    action: PositionAction,
  ) => void;
  poolInfo: RawCPMMPoolInfo | undefined;
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
          raydium={raydium}
          position={selectedPosition.position}
          selectedPool={selectedPool}
          lpAmount={selectedPosition.position.lpAmountRaw}
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
          key={`position-${position.lpMint.toBase58()}`}
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
