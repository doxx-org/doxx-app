import { Raydium } from "@doxxorg/cpmm-sdk";
import { Pool } from "@/components/earn/v2/types";

// import { UserPositionWithNFT } from "@/lib/hooks/chain/types";

interface CPMMPositionsTabProps {
  selectedPool: Pool;
  raydium: Raydium | undefined;
  // positions: UserPositionWithNFT[] | undefined;
  // isLoadingPositions: boolean;
  // allPools: Pool[] | undefined;
  // onPositionCTASuccess: () => void;
}

export const CPMMPositionsTab = (
  {
    // selectedPool,
    // raydium,
    // positions,
    // isLoadingPositions,
    // allPools,
    // onPositionCTASuccess,
  }: CPMMPositionsTabProps,
) => {
  return <div>CPMMPositionsTab</div>;
};
