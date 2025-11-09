import { useCallback, useMemo } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { ZERO } from "@/lib/constants";
import { IUseBestRouteResponse } from "@/lib/hooks/chain/useBestRoute";
import { useDoxxSwap } from "@/lib/hooks/chain/useDoxxSwap";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface SwapButtonProps {
  program: Program<DoxxAmm> | undefined;
  bestRoute: IUseBestRouteResponse | undefined;
  isQuotingRoute: boolean;
  wallet: AnchorWallet | undefined;
  token0Balance: BN | undefined;
  token1Balance: BN | undefined;
  onSuccess: (txSignature: string | undefined) => void;
  onError: (error: Error) => void;
}

export function SwapButton({
  program,
  isQuotingRoute,
  bestRoute,
  wallet,
  token0Balance,
  token1Balance,
  onSuccess,
  onError,
}: SwapButtonProps) {
  // inside a React component
  const { swapBaseInput, swapBaseOutput, isSwapping } = useDoxxSwap(
    program,
    wallet,
    onSuccess,
    onError,
  );

  const handleSwap = useCallback(async () => {
    // no min out, return undefined
    if (
      !bestRoute ||
      bestRoute.token0Amount.eq(ZERO) ||
      bestRoute.token1Amount.eq(ZERO) ||
      !token0Balance ||
      !token1Balance ||
      bestRoute.token0Amount.gt(token0Balance)
    ) {
      return undefined;
    }

    if (bestRoute.isBaseExactIn) {
      await swapBaseInput(bestRoute.pool, {
        inputMint: bestRoute.token0,
        outputMint: bestRoute.token1,
        amountIn: bestRoute.token0Amount,
        minOut: bestRoute.token1Amount,
      });
    } else {
      await swapBaseOutput(bestRoute.pool, {
        inputMint: bestRoute.token0,
        outputMint: bestRoute.token1,
        maxAmountIn: bestRoute.token0Amount,
        amountOut: bestRoute.token1Amount,
      });
    }
  }, [swapBaseInput, swapBaseOutput, bestRoute, token0Balance, token1Balance]);

  // build button label and disabled state
  const [label, disabled] = useMemo(() => {
    // validate quoting route
    if (isQuotingRoute) return ["Quoting route...", true];

    // validate best route
    if (!bestRoute || !token0Balance || !token1Balance) return ["Swap", true];

    // validate swapping
    if (isSwapping) return ["Swapping...", true];

    // validate balance
    if (bestRoute.token0Amount.gt(token0Balance)) {
      return ["Insufficient balance", true];
    }

    // happy case
    return ["Swap", false];
  }, [isSwapping, isQuotingRoute, bestRoute, token1Balance, token0Balance]);

  return (
    <Button
      className={cn(text.hsb1(), "text-green h-16 w-full rounded-xl p-6")}
      onClick={handleSwap}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
