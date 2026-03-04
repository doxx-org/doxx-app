import { useCallback, useMemo, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  Raydium as CpmmRaydium,
} from "@doxxorg/cpmm-sdk";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { PoolType } from "@/components/earn/v2/types";
import { ZERO } from "@/lib/constants";
import { IUseBestRouteV2Response } from "@/lib/hooks/chain/v2/useBestRouteV2";
import { useDoxxClmmSwapV2 } from "@/lib/hooks/chain/v2/useDoxxClmmSwapV2";
import { useDoxxCpmmSwapV2 } from "@/lib/hooks/chain/v2/useDoxxCpmmSwapV2";
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
  cpmmRaydium: CpmmRaydium | undefined;
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
  cpmmRaydium,
}: SwapButtonProps) {
  const [isHighPriceImpactAccepted, setIsHighPriceImpactAccepted] =
    useState(false);

  const isCpmm = bestRoute?.poolType === PoolType.CPMM;

  const clmm = useDoxxClmmSwapV2({
    raydium,
    program: clmmProgram,
    poolInfo: isCpmm ? undefined : bestRoute?.poolInfo,
    poolKeys: isCpmm ? undefined : bestRoute?.poolKeys,
    remainingAccounts: bestRoute?.remainingAccounts,
    wallet,
    onSuccess,
    onError,
  });

  const cpmm = useDoxxCpmmSwapV2({
    cpmmRaydium,
    poolInfo: isCpmm
      ? (bestRoute?.poolInfo as ApiV3PoolInfoStandardItemCpmm)
      : undefined,
    poolKeys: isCpmm ? (bestRoute?.poolKeys as CpmmKeys) : undefined,
    wallet,
    onSuccess,
    onError,
  });

  const isSwapping = clmm.isSwapping || cpmm.isSwapping;

  const handleSwap = useCallback(async () => {
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

      if (isCpmm) {
        await cpmm.swapBaseIn({ inputMint, amountIn: bestRoute.swapState.token0Amount, minAmountOut: minOut });
      } else {
        await clmm.swapBaseIn({ inputMint, outputMint, amountIn: bestRoute.swapState.token0Amount, minOut });
      }
    } else {
      const maxAmountIn = bestRoute.swapState.minMaxAmount;

      if (isCpmm) {
        await cpmm.swapBaseOut({ inputMint, amountOut: bestRoute.swapState.token1Amount, maxAmountIn });
      } else {
        await clmm.swapBaseOut({ inputMint, outputMint, maxAmountIn, amountOut: bestRoute.swapState.token1Amount });
      }
    }
  }, [bestRoute, token0Balance, isCpmm, clmm, cpmm]);

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
