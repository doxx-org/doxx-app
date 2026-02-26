import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { IPositionWithValue, RawPoolInfo } from "@/lib/hooks/chain/types";
import { Pool } from "../../types";

interface IncreasePositionProps {
  raydium: Raydium | undefined;
  position: IPositionWithValue;
  selectedPool: Pool;
  poolInfo: RawPoolInfo | undefined;
  onPositionCTASuccess: () => void;
}

export const IncreasePosition = ({
  raydium: _raydium,
  position: _position,
  selectedPool: _selectedPool,
  poolInfo: _poolInfo,
  onPositionCTASuccess: _onPositionCTASuccess,
}: IncreasePositionProps) => {
  return <div>IncreasePosition</div>;
};
