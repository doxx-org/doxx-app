import { Raydium } from "@doxxorg/cpmm-sdk";
import BN from "bn.js";
import {
  IUserCPMMPositionWithValue,
  RawCPMMPoolInfo,
} from "@/lib/hooks/chain/types";
import { Pool } from "../../types";

interface IncreasePositionProps {
  raydium: Raydium | undefined;
  position: IUserCPMMPositionWithValue;
  selectedPool: Pool;
  lpAmount: BN;
  poolInfo: RawCPMMPoolInfo | undefined;
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
