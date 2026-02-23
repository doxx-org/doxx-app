import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { Pool } from "../../types";

interface IncreasePositionProps {
  position: IPositionWithValue;
  selectedPool: Pool;
}

export const IncreasePosition = ({
  position: _position,
  selectedPool: _selectedPool,
}: IncreasePositionProps) => {
  return <div>IncreasePosition</div>;
};
