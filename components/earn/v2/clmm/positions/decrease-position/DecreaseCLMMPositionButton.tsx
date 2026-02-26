import { useCallback, useMemo } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import { Button } from "@/components/ui/button";
import { IPositionWithValue, RawPoolInfo } from "@/lib/hooks/chain/types";
import { useDecreaseClmmPosition } from "@/lib/hooks/chain/v2/useDecreaseClmmPosition";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

interface DecreaseCLMMPositionButtonProps {
  raydium: Raydium | undefined;
  position: IPositionWithValue;
  liquidity: BN;
  amountMinA: BN;
  amountMinB: BN;
  isClosePosition: boolean;
  poolInfo: RawPoolInfo | undefined;
  onSuccess: (txId: string) => void;
  onError: (error: Error, txId?: string) => void;
}

export const DecreaseCLMMPositionButton = ({
  raydium,
  position,
  liquidity,
  amountMinA,
  amountMinB,
  isClosePosition,
  poolInfo,
  onSuccess,
  onError,
}: DecreaseCLMMPositionButtonProps) => {
  const wallet = useAnchorWallet();

  const { decreaseClmmPosition, isDecreasing } = useDecreaseClmmPosition(
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

    await decreaseClmmPosition({
      liquidity,
      position,
      amountMinA,
      amountMinB,
      isClosePosition,
    });
  }, [
    decreaseClmmPosition,
    position,
    raydium,
    wallet,
    amountMinA,
    amountMinB,
    isClosePosition,
    poolInfo,
    liquidity,
  ]);

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
