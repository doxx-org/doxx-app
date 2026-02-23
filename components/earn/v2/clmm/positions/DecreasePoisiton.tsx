import { IPositionWithValue } from "@/lib/hooks/chain/types";
import { Pool } from "../../types";

interface DecreasePoisitionProps {
  position: IPositionWithValue;
  selectedPool: Pool;
}

export const DecreasePoisiton = ({
  position,
  selectedPool,
}: DecreasePoisitionProps) => {};
