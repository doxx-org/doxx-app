import { useCallback, useMemo, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { ZERO } from "@/lib/constants";
import { IUseBestRouteV2Response } from "@/lib/hooks/chain/v2/useBestRouteV2";
import { useDoxxClmmSwapV2 } from "@/lib/hooks/chain/v2/useDoxxClmmSwapV2";
import { DoxxClmmIdl, DoxxCpmmIdl } from "@/lib/idl";
import { text } from "@/lib/text";
import { simplifyGetAllTokenInfosErrorMsg } from "@/lib/utils/errors/get-all-token-error";
import { simplifyRoutingErrorMsg } from "@/lib/utils/errors/routing-error";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

interface SwapButtonProps {
  connection: Connection;
  cpmmProgram: Program<DoxxCpmmIdl> | undefined;
  clmmProgram: Program<DoxxClmmIdl> | undefined;
  bestRoute: IUseBestRouteV2Response | undefined;
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
  raydium: Raydium | undefined;
}

export function SwapButton({
  // connection,
  // cpmmProgram,
  clmmProgram,
  isQuotingRoute,
  bestRoute,
  wallet,
  token0Balance,
  // token1Balance,
  errors: { errorBestRoute, errorAllTokenProfiles },
  isActionable,
  onSuccess,
  onError,
  raydium,
}: SwapButtonProps) {
  const [isHighPriceImpactAccepted, setIsHighPriceImpactAccepted] =
    useState(false);

  // inside a React component
  // const cpmm = useDoxxCpmmSwap(cpmmProgram, wallet, onSuccess, onError);
  // const clmm = useDoxxClmmSwap(
  //   connection,
  //   clmmProgram,
  //   wallet,
  //   raydium,
  //   onSuccess,
  //   onError,
  // );

  const { swapBaseIn, swapBaseOut, isSwapping } = useDoxxClmmSwapV2({
    raydium,
    program: clmmProgram,
    poolInfo: bestRoute?.poolInfo,
    poolKeys: bestRoute?.poolKeys,
    remainingAccounts: bestRoute?.remainingAccounts,
    wallet,
    onSuccess,
    onError,
  });

  // const isSwapping = cpmm.isSwapping || clmm.isSwapping;

  const handleSwap = useCallback(async () => {
    // invalid inputs / balances
    if (
      !bestRoute ||
      bestRoute.swapState.token0Amount.eq(ZERO) ||
      bestRoute.swapState.token1Amount.eq(ZERO) ||
      !token0Balance ||
      (bestRoute.swapState.isBaseExactIn
        ? bestRoute.swapState.token0Amount.gt(token0Balance)
        : bestRoute.swapState.minMaxAmount.gt(token0Balance))
    ) {
      return undefined;
    }

    const inputMint = bestRoute.swapState.token0;
    const outputMint = bestRoute.swapState.token1;

    if (bestRoute.swapState.isBaseExactIn) {
      const minOut = bestRoute.swapState.minMaxAmount;
      await swapBaseIn({
        inputMint,
        outputMint,
        amountIn: bestRoute.swapState.token0Amount,
        minOut,
      });
      // TODO: uncomment when cpmm is ready
      // if (bestRoute.poolType === PoolType.CPMM) {
      //   const pool = bestRoute.pool as CPMMPoolStateWithConfig;
      //   await cpmm.swapBaseInput(pool.poolState, {
      //     inputMint,
      //     outputMint,
      //     amountIn: bestRoute.swapState.token0Amount,
      //     minOut,
      //   });
      // } else {
      //   // await clmm.swapBaseInput(pool.poolState, {
      //   await swapBaseIn({
      //     inputMint,
      //     outputMint,
      //     amountIn: bestRoute.swapState.token0Amount,
      //     minOut,
      //   });
      // }
    } else {
      const maxAmountIn = bestRoute.swapState.minMaxAmount;

      await swapBaseOut({
        inputMint,
        outputMint,
        maxAmountIn,
        amountOut: bestRoute.swapState.token1Amount,
      });

      // TODO: uncomment when cpmm is ready
      // if (bestRoute.poolType === PoolType.CPMM) {
      //   const pool = bestRoute.pool as CPMMPoolStateWithConfig;
      //   await cpmm.swapBaseOutput(pool.poolState, {
      //     inputMint,
      //     outputMint,
      //     maxAmountIn,
      //     amountOut: bestRoute.swapState.token1Amount,
      //   });
      // } else {
      // const pool = bestRoute.pool as CLMMPoolStateWithConfig;
      // await clmm.swapBaseOutput(pool.poolState, {
      // await swapBaseOut({
      //   inputMint,
      //   outputMint,
      //   maxAmountIn,
      //   amountOut: bestRoute.swapState.token1Amount,
      // });
      // }
    }
  }, [bestRoute, token0Balance, swapBaseIn, swapBaseOut]);

  const highPriceImpact = useMemo(() => {
    if (!bestRoute) return undefined;
    // reset high price impact accepted state
    // eslint-disable-next-line react-hooks/set-state-in-render
    setIsHighPriceImpactAccepted(false);

    const priceImpact = parseFloat(bestRoute.swapState.priceImpact);
    const isHighPriceImpact = priceImpact > 15; // 15%

    return {
      isHighPriceImpact,
      priceImpact,
    };
  }, [bestRoute]);

  // build button label and disabled state
  // Order matters
  const [label, disabled] = useMemo(() => {
    // validate swapping
    if (isSwapping) return ["Swapping...", true];

    if (errorAllTokenProfiles)
      return [simplifyGetAllTokenInfosErrorMsg(errorAllTokenProfiles), true];

    // validate quoting route
    if (isQuotingRoute) return ["Quoting route...", true];

    if (!!errorBestRoute)
      return [simplifyRoutingErrorMsg(errorBestRoute), true];

    // validate best route
    if (
      !bestRoute ||
      (highPriceImpact?.isHighPriceImpact && !isHighPriceImpactAccepted)
    )
      return ["Swap", true];

    // validate balance
    const requiredIn = bestRoute.swapState.isBaseExactIn
      ? bestRoute.swapState.token0Amount
      : bestRoute.swapState.minMaxAmount;
    if (!token0Balance || requiredIn.gt(token0Balance)) {
      return ["Insufficient balance", true];
    }

    if (!isActionable) return ["Loading...", true];

    // happy case
    return ["Swap", false];
  }, [
    isSwapping,
    isQuotingRoute,
    bestRoute,
    token0Balance,
    errorAllTokenProfiles,
    isActionable,
    errorBestRoute,
    highPriceImpact,
    isHighPriceImpactAccepted,
  ]);

  const isLoading = useMemo(() => {
    return isSwapping || isQuotingRoute;
  }, [isSwapping, isQuotingRoute]);

  return (
    <div className="flex w-full flex-col">
      {highPriceImpact?.isHighPriceImpact && !isHighPriceImpactAccepted && (
        <div className="border-orange/70 bg-orange/10 flex w-full items-center justify-between rounded-xl border px-3 py-3">
          <div className={cn("flex flex-col gap-1 text-gray-200", text.sb3())}>
            <p>Price impact is over 15%!</p>
            <p>Are you confirm to proceed?</p>
          </div>
          <Button
            className={cn(
              text.sb3(),
              "bg-orange/30 border-orange/70 hover:bg-orange/40 h-4 rounded-xl border px-3 py-4 text-gray-200",
            )}
            onClick={() => setIsHighPriceImpactAccepted(true)}
          >
            Confirm
          </Button>
        </div>
      )}
      <Button
        className={cn(text.hsb1(), "text-green mt-3 h-16 w-full rounded-xl")}
        onClick={handleSwap}
        disabled={disabled}
        loading={isLoading}
      >
        {label}
      </Button>
      {/* </div> */}
    </div>
  );
}
