import { Pool } from "../PoolColumn";
import { CLMMPoolDrawer } from "./clmm/CLMMPoolDrawer";
import { CPMMPoolDrawer } from "./cpmm/CPMMPoolDrawer";
import { PoolType } from "./types";

interface DepositPoolDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // createPoolType: PoolType;
  selectedPool: Pool;
}

export const DepositPoolDrawer = ({
  isOpen,
  onOpenChange,
  selectedPool,
}: DepositPoolDrawerProps) => {
  if (selectedPool.poolType === PoolType.CPMM) {
    return <CPMMPoolDrawer isOpen={isOpen} onOpenChange={onOpenChange} selectedPool={selectedPool} />;
  }

  return <CLMMPoolDrawer isOpen={isOpen} onOpenChange={onOpenChange} selectedPool={selectedPool} />;
};
