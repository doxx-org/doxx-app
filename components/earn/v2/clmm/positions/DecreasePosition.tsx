import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { Pool } from "../../types";

interface DecreasePositionProps {
  position: IPositionWithValue;
  selectedPool: Pool;
}

export const DecreasePosition = ({
  position,
  selectedPool,
}: DecreasePositionProps) => {
  return <div>DecreasePosition</div>;
};
