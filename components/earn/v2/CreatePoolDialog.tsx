import { TokenProfile } from "@/lib/config/tokens";
import { SplBalance } from "@/lib/hooks/chain/types";
import { CreateCPMMPoolDialog } from "../CreateCPMMPoolDialog";
import { PoolType } from "./types";

interface CreatePoolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  splBalances: Partial<Record<string, SplBalance>> | undefined;
  createPoolType: PoolType;
  allTokenProfiles: TokenProfile[];
}

export const CreatePoolDialog = ({
  isOpen,
  onOpenChange,
  splBalances,
  createPoolType,
  allTokenProfiles,
}: CreatePoolDialogProps) => {
  if (createPoolType === PoolType.CPMM) {
    return (
      <CreateCPMMPoolDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        splBalances={splBalances}
        allTokenProfiles={allTokenProfiles}
      />
    );
  }

  return "Create CLMM Pool";
  // return <CLMMPoolDialog isOpen={isOpen} onOpenChange={onOpenChange} />;
};
