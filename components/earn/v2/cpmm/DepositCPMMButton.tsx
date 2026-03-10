import { useCallback, useMemo } from "react";
import { Program } from "@coral-xyz/anchor";
import { Raydium } from "@doxxorg/cpmm-sdk";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "bn.js";
import { toast } from "sonner";
import { DepositPoolSuccessToast } from "@/components/toast/DepositPool";
import { Button } from "@/components/ui/button";
import { TokenProfile } from "@/lib/config/tokens";
import {
  BalanceMapByMint,
  CPMMPoolState,
  PrepareOpenCPMMPositionData,
} from "@/lib/hooks/chain/types";
import { useDepositCPMM } from "@/lib/hooks/chain/useDepositCPMM";
import { DoxxCpmmIdl } from "@/lib/idl";
import { text } from "@/lib/text";
import { cn, parseAmountBN, simplifyErrorMessage, toBN } from "@/lib/utils";

interface IDepositCPMMButtonProps {
  raydium: Raydium | undefined;
  poolId: string;
  baseIn: boolean;
  tokenA: TokenProfile;
  tokenB: TokenProfile;
  tokenAAmount: string;
  tokenBAmount: string;
  lpTokenAmount: string;
  poolState: CPMMPoolState;
  wallet: AnchorWallet | undefined;
  walletBalances: BalanceMapByMint | undefined;
  doxxAmmProgram: Program<DoxxCpmmIdl> | undefined;
  prepareOpenCPMMPositionData: PrepareOpenCPMMPositionData | undefined;
  onSuccess?: () => void;
  onError?: () => void;
}

export const DepositCPMMButton = ({
  raydium,
  baseIn,
  tokenA,
  tokenB,
  tokenAAmount,
  tokenBAmount,
  lpTokenAmount,
  wallet,
  walletBalances,
  poolState,
  doxxAmmProgram,
  prepareOpenCPMMPositionData,
  onSuccess,
  onError,
}: IDepositCPMMButtonProps) => {
  const [amount0, amount1, _lpAmount] = useMemo(() => {
    // Check which UI token corresponds to which pool token
    const isTokenAToken0 = poolState.token0Mint.toBase58() === tokenA.address;

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
    const lpAmount = parseAmountBN(lpTokenAmount, 9); // LP tokens typically use 9 decimals

    return [amount0, amount1, lpAmount];
  }, [
    poolState.token0Mint,
    tokenAAmount,
    tokenBAmount,
    lpTokenAmount,
    tokenA,
    tokenB,
  ]);

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

  const { deposit, isDepositing } = useDepositCPMM(
    raydium,
    doxxAmmProgram,
    wallet,
    baseIn,
    handleSuccess,
    handleError,
  );

  const handleDeposit = useCallback(async () => {
    if (!prepareOpenCPMMPositionData) {
      toast.error("Cannot simulate deposit CPMM position");
      return;
    }

    try {
      await deposit({
        prepareOpenCPMMPositionData,
      });
    } catch (error) {
      console.error("Deposit error:", error);
      // Error is already handled by handleError callback
    }
  }, [deposit, prepareOpenCPMMPositionData]);

  const [label, disabled, handleDepositButton] = useMemo(() => {
    if (isDepositing) {
      return ["Depositing Pool...", true, undefined];
    }

    if (
      // tokenABalance === 0n ||
      // tokenBBalance === 0n ||
      amount0.lte(new BN(0)) ||
      amount1.lte(new BN(0)) ||
      !walletBalances
    ) {
      return ["Deposit", true, undefined];
    }

    const tokenABalance = walletBalances?.[tokenA.address]?.rawAmount ?? 0n;
    const tokenBBalance = walletBalances?.[tokenB.address]?.rawAmount ?? 0n;

    // if (toBN(tokenABalance).lt(amount0) || toBN(tokenBBalance).lt(amount1)) {
    //   return ["Insufficient Balance", true, undefined];
    // }

    return ["Deposit", false, handleDeposit];
  }, [
    amount0,
    amount1,
    isDepositing,
    handleDeposit,
    walletBalances,
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
