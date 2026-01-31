import { useCallback, useMemo } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { ZERO } from "@/lib/constants";
import { IUseBestRouteResponse } from "@/lib/hooks/chain/useBestRoute";
import { useDoxxCpSwap } from "@/lib/hooks/chain/useDoxxCpSwap";
import { DoxxCpmmIdl } from "@/lib/idl";
import { text } from "@/lib/text";
import { simplifyGetAllTokenInfosErrorMsg } from "@/lib/utils/errors/get-all-token-error";
import { simplifyRoutingErrorMsg } from "@/lib/utils/errors/routing-error";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface SwapButtonProps {
  program: Program<DoxxCpmmIdl> | undefined;
  bestRoute: IUseBestRouteResponse | undefined;
  isQuotingRoute: boolean;
  wallet: AnchorWallet | undefined;
  token0Balance: BN | undefined;
  token1Balance: BN | undefined;
  errors: {
    errorBestRoute: Error | null | undefined;
    errorAllTokenProfiles: Error | null | undefined;
  };
  isActionable: boolean;
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
  errors: { errorBestRoute, errorAllTokenProfiles },
  isActionable,
  onSuccess,
  onError,
}: SwapButtonProps) {
  // inside a React component
  const { swapBaseInput, swapBaseOutput, isSwapping } = useDoxxCpSwap(
    program,
    wallet,
    onSuccess,
    onError,
  );

  const handleSwap = useCallback(async () => {
    // no min out, return undefined
    if (
      !bestRoute ||
      bestRoute.swapState.token0Amount.eq(ZERO) ||
      bestRoute.swapState.token1Amount.eq(ZERO) ||
      !token0Balance ||
      !token1Balance ||
      bestRoute.swapState.token0Amount.gt(token0Balance)
    ) {
      return undefined;
    }

    if (bestRoute.swapState.isBaseExactIn) {
      await swapBaseInput(bestRoute.pool.poolState, {
        inputMint: bestRoute.swapState.token0,
        outputMint: bestRoute.swapState.token1,
        amountIn: bestRoute.swapState.token0Amount,
        minOut: bestRoute.swapState.token1Amount,
      });
    } else {
      await swapBaseOutput(bestRoute.pool.poolState, {
        inputMint: bestRoute.swapState.token0,
        outputMint: bestRoute.swapState.token1,
        maxAmountIn: bestRoute.swapState.token0Amount,
        amountOut: bestRoute.swapState.token1Amount,
      });
    }
  }, [swapBaseInput, swapBaseOutput, bestRoute, token0Balance, token1Balance]);

  // build button label and disabled state
  // Order matters
  const [label, disabled] = useMemo(() => {
    if (errorAllTokenProfiles !== null)
      return [simplifyGetAllTokenInfosErrorMsg(errorAllTokenProfiles), true];

    // validate quoting route
    if (isQuotingRoute) return ["Quoting route...", true];

    if (!!errorBestRoute)
      return [simplifyRoutingErrorMsg(errorBestRoute), true];

    // validate best route
    if (!bestRoute || !token0Balance || !token1Balance) return ["Swap", true];

    // validate swapping
    if (isSwapping) return ["Swapping...", true];

    // validate balance
    if (bestRoute.swapState.token0Amount.gt(token0Balance)) {
      return ["Insufficient balance", true];
    }

    if (!isActionable) return ["Loading...", true];

    // happy case
    return ["Swap", false];
  }, [
    isSwapping,
    isQuotingRoute,
    bestRoute,
    token1Balance,
    token0Balance,
    errorAllTokenProfiles,
    isActionable,
    errorBestRoute,
  ]);

  const isLoading = useMemo(() => {
    return isSwapping || isQuotingRoute;
  }, [isSwapping, isQuotingRoute]);

  return (
    <Button
      className={cn(text.hsb1(), "text-green h-16 w-full rounded-xl p-6")}
      onClick={handleSwap}
      disabled={disabled}
      loading={isLoading}
    >
      {label}
    </Button>
  );
}
