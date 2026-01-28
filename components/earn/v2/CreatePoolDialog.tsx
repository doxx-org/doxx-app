import { TokenProfile } from "@/lib/config/tokens";
import { PoolStateWithConfig, SplBalance } from "@/lib/hooks/chain/types";
import { CreateCLMMPoolDialog } from "../CreateCLMMPoolDialog";
import { CreateCPMMPoolDialog } from "../CreateCPMMPoolDialog";
import { PoolType } from "./types";

interface CreatePoolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  splBalances: Partial<Record<string, SplBalance>> | undefined;
  createPoolType: PoolType;
  allTokenProfiles: TokenProfile[];
  poolsData: PoolStateWithConfig[] | undefined;
}

export const CreatePoolDialog = ({
  isOpen,
  onOpenChange,
  splBalances,
  createPoolType,
  allTokenProfiles,
  poolsData,
}: CreatePoolDialogProps) => {
  if (createPoolType === PoolType.CPMM) {
    return (
      <CreateCPMMPoolDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        splBalances={splBalances}
        allTokenProfiles={allTokenProfiles}
        poolsData={poolsData}
      />
    );
  }

  return (
    <CreateCLMMPoolDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      splBalances={splBalances}
      allTokenProfiles={allTokenProfiles}
      poolsData={poolsData}
    />
  );
};
