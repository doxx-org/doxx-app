import { Pool } from "@/components/earn/v2/types";
import { DepositCLMMDrawer } from "./clmm/deposit/DepositCLMMDrawer";
import { DepositCPMMDrawer } from "./cpmm/DepositCPMMDrawer";
import { PoolType } from "./types";

interface DepositPoolDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPool: Pool;
}

export const DepositPoolDrawer = ({
  isOpen,
  onOpenChange,
  selectedPool,
}: DepositPoolDrawerProps) => {
  if (selectedPool.poolType === PoolType.CPMM) {
    return (
      <DepositCPMMDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        selectedPool={selectedPool}
      />
    );
  }

  return (
    <DepositCLMMDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      selectedPool={selectedPool}
    />
  );
};
