import { useCallback, useMemo } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "bn.js";
import { toast } from "sonner";
import { DepositPoolSuccessToast } from "@/components/toast/DepositPool";
import { Button } from "@/components/ui/button";
import { TokenProfile } from "@/lib/config/tokens";
import {
  BalanceMapByMint,
  CLMMPoolState,
  PrepareOpenCLMMPositionData,
} from "@/lib/hooks/chain/types";
import { useDepositClmmPool } from "@/lib/hooks/chain/useDepositClmmPool";
import { text } from "@/lib/text";
import { cn, parseAmountBN, simplifyErrorMessage, toBN } from "@/lib/utils";
import { PriceMode } from "../../types";

interface IDepositCLMMButtonProps {
  raydium: Raydium | undefined;
  tokenA: TokenProfile;
  tokenB: TokenProfile;
  tokenAAmount: string;
  tokenBAmount: string;
  priceMode: PriceMode;
  minPriceAperB: string | undefined;
  maxPriceAperB: string | undefined;
  baseIn: boolean;
  prepareOpenCLMMPositionData: PrepareOpenCLMMPositionData | undefined;
  poolState: CLMMPoolState | undefined;
  wallet: AnchorWallet | undefined;
  walletBalances: BalanceMapByMint | undefined;
  onSuccess?: () => void;
  onError?: () => void;
}

export const DepositCLMMButton = ({
  raydium,
  tokenA,
  tokenB,
  tokenAAmount,
  tokenBAmount,
  priceMode,
  minPriceAperB,
  maxPriceAperB,
  baseIn,
  prepareOpenCLMMPositionData,
  wallet,
  walletBalances,
  poolState,
  onSuccess,
  onError,
}: IDepositCLMMButtonProps) => {
  const [amount0, amount1] = useMemo(() => {
    if (!poolState) {
      return [new BN(0), new BN(0), new BN(0)];
    }
    // Check which UI token corresponds to which pool token
    const isTokenAToken0 = poolState.tokenMint0.toBase58() === tokenA.address;

    // Map amounts correctly
    const actualAmount0 = isTokenAToken0 ? tokenAAmount : tokenBAmount;
    const actualAmount1 = isTokenAToken0 ? tokenBAmount : tokenAAmount;
    const actualToken0Decimal = isTokenAToken0
      ? tokenA.decimals
      : tokenB.decimals;
    const actualToken1Decimal = isTokenAToken0
      ? tokenB.decimals
      : tokenA.decimals;

    // Convert amounts to BN with proper decimals
    const amount0 = parseAmountBN(actualAmount0, actualToken0Decimal);
    const amount1 = parseAmountBN(actualAmount1, actualToken1Decimal);

    return [amount0, amount1];
  }, [poolState, tokenAAmount, tokenBAmount, tokenA, tokenB]);

  const handleSuccess = useCallback(
    (txSignature: string | undefined) => {
      if (txSignature) {
        toast.success(<DepositPoolSuccessToast txSignature={txSignature} />);
      } else {
        toast.success("Deposit successful!");
      }

      onSuccess?.();
    },
    [onSuccess],
  );

  const handleError = useCallback(
    (error: Error) => {
      toast.error(simplifyErrorMessage(error, "Deposit failed"));
      onError?.();
    },
    [onError],
  );

  const { createPosition, isDepositing } = useDepositClmmPool(
    raydium,
    wallet,
    handleSuccess,
    handleError,
  );

  const handleDeposit = useCallback(async () => {
    if (
      !poolState ||
      !prepareOpenCLMMPositionData ||
      !tokenAAmount ||
      !tokenBAmount
    ) {
      toast.error("Please enter amounts for both tokens");
      return;
    }

    try {
      // console.log("Depositing to pool:", {
      //   poolId,
      //   uiTokenA: tokenA.symbol,
      //   uiTokenB: tokenB.symbol,
      //   uiAmountA: tokenAAmount,
      //   uiAmountB: tokenBAmount,
      //   poolToken0: poolState?.tokenMint0.toBase58(),
      //   poolToken1: poolState?.tokenMint1.toBase58(),
      //   actualAmount0: amount0,
      //   actualAmount1: amount1,
      // });

      await createPosition({
        prepareOpenCLMMPositionData,
        tickSpacing: poolState.tickSpacing,
        baseIn,
        amountA: tokenAAmount,
        amountB: tokenBAmount,
        priceMode,
        minPriceAperB,
        maxPriceAperB,
      });
    } catch (error) {
      console.error("Deposit error:", error);
      // Error is already handled by handleError callback
    }
  }, [
    // amount0,
    // amount1,
    priceMode,
    minPriceAperB,
    maxPriceAperB,
    tokenAAmount,
    tokenBAmount,
    prepareOpenCLMMPositionData,
    baseIn,
    poolState,
    createPosition,
  ]);

  const [label, disabled, handleDepositButton] = useMemo(() => {
    if (isDepositing) {
      return ["Depositing Pool...", true, undefined];
    }

    const tokenABalance = walletBalances?.[tokenA.address]?.rawAmount;
    const tokenBBalance = walletBalances?.[tokenB.address]?.rawAmount;

    if (
      tokenABalance === undefined ||
      tokenBBalance === undefined ||
      amount0.lte(new BN(0)) ||
      amount1.lte(new BN(0)) ||
      !walletBalances
    ) {
      return ["Deposit", true, undefined];
    }

    if (toBN(tokenABalance).lt(amount0) || toBN(tokenBBalance).lt(amount1)) {
      return ["Insufficient Balance", true, undefined];
    }

    return ["Deposit", false, handleDeposit];
  }, [
    amount0,
    amount1,
    handleDeposit,
    walletBalances,
    isDepositing,
    tokenA,
    tokenB,
  ]);

  return (
    <Button
      className={cn(text.hsb1(), "text-green h-13 py-6")}
      onClick={handleDepositButton}
      disabled={disabled}
    >
      {label}
    </Button>
  );
};
