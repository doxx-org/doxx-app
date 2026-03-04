import { useCallback, useMemo } from "react";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import { Button } from "@/components/ui/button";
import { RawCPMMPoolInfo } from "@/lib/hooks/chain/types";
import { useDecreaseCpmmPosition } from "@/lib/hooks/chain/v2/useDecreaseCpmmPosition";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

interface DecreaseCPMMPositionButtonProps {
  raydium: Raydium | undefined;
  lpAmount: BN;
  poolInfo: RawCPMMPoolInfo | undefined;
  onSuccess: (txId: string) => void;
  onError: (error: Error, txId?: string) => void;
}

export const DecreaseCPMMPositionButton = ({
  raydium,
  lpAmount,
  poolInfo,
  onSuccess,
  onError,
}: DecreaseCPMMPositionButtonProps) => {
  const wallet = useAnchorWallet();

  const { decreaseCpmmPosition, isDecreasing } = useDecreaseCpmmPosition(
    raydium,
    wallet,
    poolInfo,
    onSuccess,
    onError,
  );

  const handleDecreaseButton = useCallback(async () => {
    if (!raydium || !wallet || !poolInfo) {
      return;
    }

    await decreaseCpmmPosition({
      lpAmount,
    });
  }, [decreaseCpmmPosition, lpAmount, raydium, wallet, poolInfo]);

  const [label, disabled, handleDecreasePosition] = useMemo(() => {
    if (isDecreasing) {
      return ["Decreasing Position...", true, undefined];
    }

    return ["Decrease Position", false, handleDecreaseButton];
  }, [handleDecreaseButton, isDecreasing]);

  return (
    <Button
      className={cn(
        text.hsb1(),
        "bg-green text-black-900 border-green hover:bg-green/80 hover:border-green/80 w-full rounded-[12px] border p-0 py-6",
      )}
      onClick={handleDecreasePosition}
      disabled={disabled}
    >
      {label}
    </Button>
  );
};
