import { useCallback, useMemo } from "react";
import { Program } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PoolState } from "@/lib/hooks/chain/types";
import { useDepositCPMM } from "@/lib/hooks/chain/useDepositCPMM";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import { text } from "@/lib/text";
import { cn, parseAmountBN, simplifyErrorMessage, toBN } from "@/lib/utils";

interface IDepositCPMMButtonProps {
  poolId: string;
  tokenA: TokenProfile;
  tokenB: TokenProfile;
  tokenAAmount: string;
  tokenBAmount: string;
  lpTokenAmount: string;
  poolState: PoolState;
  wallet: AnchorWallet | undefined;
  walletBalances: BalanceMapByMint | undefined;
  doxxAmmProgram: Program<DoxxAmm> | undefined;
  onSuccess?: () => void;
  onError?: () => void;
}

export const DepositCPMMButton = ({
  poolId,
  tokenA,
  tokenB,
  tokenAAmount,
  tokenBAmount,
  lpTokenAmount,
  wallet,
  walletBalances,
  poolState,
  doxxAmmProgram,
  onSuccess,
  onError,
}: IDepositCPMMButtonProps) => {
  const [amount0, amount1, lpAmount] = useMemo(() => {
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
        const explorerUrl = `https://solscan.io/tx/${txSignature}?cluster=testnet`;
        toast.success(
          <div>
            Deposit successful!
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline"
            >
              View on Solscan
            </a>
          </div>,
          { duration: 10000 },
        );
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
    doxxAmmProgram,
    wallet,
    handleSuccess,
    handleError,
  );

  const handleDeposit = useCallback(async () => {
    if (
      !poolState ||
      !poolId ||
      !tokenA ||
      !tokenB ||
      !tokenAAmount ||
      !tokenBAmount ||
      !doxxAmmProgram
    ) {
      toast.error("Please enter amounts for both tokens");
      return;
    }

    try {
      // IMPORTANT: tokenA/tokenB in UI might not match token0/token1 in pool
      // poolState.token0Mint is always < token1Mint (sorted by public key)
      // We need to map our UI amounts to the correct pool tokens

      // // Check which UI token corresponds to which pool token
      // const isTokenAToken0 = poolState.token0Mint.toBase58() === tokenA.address;

      // // Map amounts correctly
      // const actualAmount0 = isTokenAToken0 ? tokenAAmount : tokenBAmount;
      // const actualAmount1 = isTokenAToken0 ? tokenBAmount : tokenAAmount;
      // const actualToken0Decimal = isTokenAToken0
      //   ? tokenA.decimals
      //   : tokenB.decimals;
      // const actualToken1Decimal = isTokenAToken0
      //   ? tokenB.decimals
      //   : tokenA.decimals;

      // // Convert amounts to BN with proper decimals
      // const amount0 = parseAmountBN(actualAmount0, actualToken0Decimal);
      // const amount1 = parseAmountBN(actualAmount1, actualToken1Decimal);
      // const lpAmount = parseAmountBN(lpTokenAmount, 9); // LP tokens typically use 9 decimals

      // Use higher slippage tolerance (10%) for safety
      const slippageTolerance = 0.1;
      const maxAmount0 = amount0
        .muln(Math.floor(100 * (1 + slippageTolerance)))
        .divn(100);
      const maxAmount1 = amount1
        .muln(Math.floor(100 * (1 + slippageTolerance)))
        .divn(100);

      console.log("Depositing to pool:", {
        poolId,
        uiTokenA: tokenA.symbol,
        uiTokenB: tokenB.symbol,
        uiAmountA: tokenAAmount,
        uiAmountB: tokenBAmount,
        poolToken0: poolState.token0Mint.toBase58(),
        poolToken1: poolState.token1Mint.toBase58(),
        // isTokenAToken0,
        actualAmount0: amount0,
        actualAmount1: amount1,
        lpAmount: lpAmount.toString(),
        // maxAmount0: maxAmount0.toString(),
        // maxAmount1: maxAmount1.toString(),
        slippage: `${slippageTolerance * 100}%`,
      });

      await deposit({
        poolState: new PublicKey(poolId),
        token0Mint: poolState.token0Mint,
        token1Mint: poolState.token1Mint,
        lpMint: poolState.lpMint,
        token0Vault: poolState.token0Vault,
        token1Vault: poolState.token1Vault,
        token0Program: poolState.token0Program,
        token1Program: poolState.token1Program,
        lpTokenAmount: lpAmount,
        maximumToken0Amount: amount0,
        maximumToken1Amount: amount1,
      });
    } catch (error) {
      console.error("Deposit error:", error);
      // Error is already handled by handleError callback
    }
  }, [amount0, amount1, lpAmount]);

  const [label, disabled, handleDepositButton] = useMemo(() => {
    if (isDepositing) {
      return ["Depositing Pool...", true, undefined];
    }

    const tokenABalance = walletBalances?.[tokenA.address]?.rawAmount;
    console.log("🚀 ~ tokenABalance:", tokenABalance);
    const tokenBBalance = walletBalances?.[tokenB.address]?.rawAmount;
    console.log("🚀 ~ tokenBBalance:", tokenBBalance);

    console.log("🚀 ~ amount0:", amount0.toString());

    console.log("🚀 ~ amount1:", amount1.toString());
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
  }, [amount0, amount1, lpAmount, isDepositing, handleDeposit, walletBalances]);

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
