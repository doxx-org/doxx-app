import { TokenProfile } from "@/lib/config/tokens";
import {
  CLMMPoolStateWithConfig,
  CPMMPoolStateWithConfig,
  SplBalance,
} from "@/lib/hooks/chain/types";
import { CreateCLMMPoolDialog } from "./clmm/CreateCLMMPoolDialog";
import { CreateCPMMPoolDialog } from "./cpmm/CreateCPMMPoolDialog";
import { PoolType } from "./types";

interface CreatePoolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  splBalances: Partial<Record<string, SplBalance>> | undefined;
  createPoolType: PoolType;
  allTokenProfiles: TokenProfile[];
  poolsData: CPMMPoolStateWithConfig[] | CLMMPoolStateWithConfig[] | undefined;
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
        poolsData={poolsData as CPMMPoolStateWithConfig[] | undefined}
      />
    );
  }

  return (
    <CreateCLMMPoolDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      splBalances={splBalances}
      allTokenProfiles={allTokenProfiles}
      poolsData={poolsData as CLMMPoolStateWithConfig[] | undefined}
    />
  );
};
