import { useCallback, useMemo } from "react";
import { Program } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TokenProfile } from "@/lib/config/tokens";
import { PoolState } from "@/lib/hooks/chain/types";
import { useDoxxSwap } from "@/lib/hooks/chain/useDoxxSwap";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface SwapButtonProps {
  program: Program<DoxxAmm> | undefined;
  token0: TokenProfile;
  token1: TokenProfile;
  amount0: string;
  amount1: string;
  poolState: PoolState | undefined;
  wallet: AnchorWallet | undefined;
  onSuccess: (txSignature: string | undefined) => void;
  onError: (error: Error) => void;
}

export function SwapButton({
  program,
  token0,
  token1,
  amount0,
  amount1,
  poolState,
  wallet,
  onSuccess,
  onError,
}: SwapButtonProps) {
  // TODO: handle swap base output
  const { swapBaseInput, isSwapping } = useDoxxSwap(
    program,
    wallet,
    poolState,
    onSuccess,
    onError,
  );

  const handleSwap = useCallback(async () => {
    return await swapBaseInput({
      amountIn: amount0,
      minOut: amount1,
      inputMint: new PublicKey(token0.address),
      outputMint: new PublicKey(token1.address),
    });
  }, [token0, token1, amount0, amount1, swapBaseInput]);

  const label = useMemo(() => {
    if (isSwapping) return "Swapping...";

    return "Swap";
  }, [isSwapping]);

  return (
    <Button
      className={cn(text.hsb1(), "text-green h-16 w-full rounded-xl p-6")}
      onClick={handleSwap}
      disabled={isSwapping}
    >
      {label}
    </Button>
  );
}
