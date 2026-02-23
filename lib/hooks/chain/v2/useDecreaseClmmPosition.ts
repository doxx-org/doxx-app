import { useCallback, useState } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";

interface UseDecreaseClmmPositionParams {
  raydium: Raydium | undefined;
  wallet: AnchorWallet | undefined;
}

export function useDecreaseClmmPosition(
  raydium: Raydium | undefined,
  wallet: AnchorWallet | undefined,
) {
  const [isDecreasing, setIsDecreasing] = useState(false);
  const [decreaseError, setDecreaseError] = useState<Error | undefined>(
    undefined,
  );

  const decreaseClmmPosition = useCallback(async () => {}, []);

  return {
    decreaseClmmPosition,
    isDecreasing,
    decreaseError,
  };
}
