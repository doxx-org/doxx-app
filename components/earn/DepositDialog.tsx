"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import {
  TokenProfile,
  TokenSymbol,
  knownTokenProfiles,
} from "@/lib/config/tokens";
import { CPMMPoolState } from "@/lib/hooks/chain/types";
import { useDeposit } from "@/lib/hooks/chain/useDeposit";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { usePoolLpSupply } from "@/lib/hooks/chain/usePoolLpSupply";
import { usePoolVaultBalances } from "@/lib/hooks/chain/usePoolVaultBalances";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { text } from "@/lib/text";
import { cn, simplifyErrorMessage } from "@/lib/utils";
import { parseAmountBN, parseDecimalsInput } from "@/lib/utils/number";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { TokenSelectionRow } from "./TokenSelectionRow";

interface DepositDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  poolState: CPMMPoolState | null;
  poolStateAddress: string | null; // The public key of the pool state account
}

export const DepositDialog = ({
  isOpen,
  onOpenChange,
  poolState,
  poolStateAddress,
}: DepositDialogProps) => {
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxCpmmProgram({ provider });

  // Get token profiles from pool state
  const tokenA = useMemo(() => {
    if (!poolState) return null;
    return (
      knownTokenProfiles.find(
        (t) => t.address === poolState.token0Mint.toBase58(),
      ) ?? null
    );
  }, [poolState]);

  const tokenB = useMemo(() => {
    if (!poolState) return null;
    return (
      knownTokenProfiles.find(
        (t) => t.address === poolState.token1Mint.toBase58(),
      ) ?? null
    );
  }, [poolState]);

  // Fetch token balances
  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    knownTokenProfiles,
  );

  // Fetch pool vault balances
  const { data: vaultBalances } = usePoolVaultBalances(
    connection,
    poolState?.token0Vault,
    poolState?.token1Vault,
  );

  // Fetch LP token supply
  const { data: lpSupply } = usePoolLpSupply(connection, poolState?.lpMint);

  // Calculate LP tokens to receive based on pool reserves and deposit amounts
  const lpTokenAmount = useMemo((): string => {
    if (
      !poolState ||
      !tokenA ||
      !tokenB ||
      !amountA ||
      !amountB ||
      amountA === "" ||
      amountB === ""
    ) {
      return "";
    }

    const numAmountA = parseFloat(amountA);
    const numAmountB = parseFloat(amountB);

    if (
      isNaN(numAmountA) ||
      isNaN(numAmountB) ||
      numAmountA <= 0 ||
      numAmountB <= 0
    ) {
      return "";
    }

    // If we have vault balances and LP supply, calculate properly
    if (
      vaultBalances &&
      lpSupply &&
      vaultBalances.token0Balance > 0n &&
      vaultBalances.token1Balance > 0n &&
      lpSupply > 0n
    ) {
      // CRITICAL: Map UI amounts to pool token order
      // tokenA is always poolState.token0Mint, tokenB is always poolState.token1Mint
      // So numAmountA corresponds to token0, numAmountB corresponds to token1

      // Convert user amounts to base units (already in correct order)
      const amount0Base = numAmountA * Math.pow(10, tokenA.decimals);
      const amount1Base = numAmountB * Math.pow(10, tokenB.decimals);

      // Get reserves in base units
      const reserve0 = Number(vaultBalances.token0Balance);
      const reserve1 = Number(vaultBalances.token1Balance);
      const totalLpSupply = Number(lpSupply);

      // For existing pools: LP = min(amount0/reserve0, amount1/reserve1) * totalSupply
      // This ensures we deposit at the current pool ratio
      const ratio0 = amount0Base / reserve0;
      const ratio1 = amount1Base / reserve1;
      const minRatio = Math.min(ratio0, ratio1);

      // Calculate LP tokens to mint
      const lpToMint = minRatio * totalLpSupply;

      console.log("LP Calculation:", {
        tokenA_symbol: tokenA.symbol,
        tokenB_symbol: tokenB.symbol,
        tokenA_address: tokenA.address,
        tokenB_address: tokenB.address,
        poolToken0: poolState.token0Mint.toBase58(),
        poolToken1: poolState.token1Mint.toBase58(),
        numAmountA,
        numAmountB,
        amount0Base,
        amount1Base,
        reserve0,
        reserve1,
        totalLpSupply,
        ratio0,
        ratio1,
        minRatio,
        lpToMint,
        lpTokensHumanReadable: (lpToMint / Math.pow(10, 9)).toFixed(6),
      });

      return (lpToMint / Math.pow(10, 9)).toFixed(6);
    }

    // Fallback: use sqrt formula for initial deposit or if balances unavailable
    const lpAmount = Math.sqrt(numAmountA * numAmountB);
    return lpAmount.toFixed(6);
  }, [poolState, tokenA, tokenB, amountA, amountB, vaultBalances, lpSupply]);

  // Calculate share of pool percentage
  const shareOfPool = useMemo((): number => {
    if (!lpTokenAmount || lpTokenAmount === "" || !lpSupply) {
      return 0;
    }

    const lpAmount = parseFloat(lpTokenAmount);
    if (isNaN(lpAmount) || lpAmount <= 0) return 0;

    const lpAmountBase = lpAmount * Math.pow(10, 9);
    const currentSupply = Number(lpSupply);

    // Calculate percentage: newLp / (currentSupply + newLp) * 100
    const percentage = (lpAmountBase / (currentSupply + lpAmountBase)) * 100;

    return percentage;
  }, [lpTokenAmount, lpSupply]);

  // Calculate earned fees (placeholder - in production this would come from chain data)
  const earnedFees = useMemo((): number => {
    // This is a placeholder. In production, you'd fetch actual fee data
    // from the pool's accumulated fees
    return 0.03;
  }, []);

  const tokenBalances = useMemo(
    () => ({
      tokenA:
        tokenA && splBalances ? (splBalances[tokenA.address]?.amount ?? 0) : 0,
      tokenB:
        tokenB && splBalances ? (splBalances[tokenB.address]?.amount ?? 0) : 0,
    }),
    [tokenA, tokenB, splBalances],
  );

  const usdValues = useMemo(() => {
    const getTokenPrice = (token: TokenProfile | null): number => {
      if (!token || !token.symbol) return 0;
      // Placeholder prices - in a real app, these would come from a price API
      const mockPrices: Record<string, number> = {
        [TokenSymbol.USDC]: 1.0,
        [TokenSymbol.sUSD]: 1.0,
        [TokenSymbol.LAYER]: 0.05,
        [TokenSymbol.sSOL]: 180.0,
      };
      return mockPrices[token.symbol] ?? 0;
    };

    const calculateValue = (
      token: TokenProfile | null,
      amount: string,
    ): number => {
      if (!token || !amount || amount === "") return 0;
      const price = getTokenPrice(token);
      const numericAmount = parseFloat(amount);
      return isNaN(numericAmount) ? 0 : numericAmount * price;
    };

    const tokenAValue = calculateValue(tokenA, amountA);
    const tokenBValue = calculateValue(tokenB, amountB);

    return {
      tokenA: tokenAValue,
      tokenB: tokenBValue,
      total: tokenAValue + tokenBValue,
    };
  }, [tokenA, tokenB, amountA, amountB]);

  const handleAmountChange = (
    value: string,
    setAmount: (value: string) => void,
  ) => {
    // Allow empty string, numbers, and decimal points
    if (parseDecimalsInput(value)) {
      setAmount(value);
    }
  };

  const handleSuccess = (txSignature: string | undefined) => {
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

    // Reset form
    setAmountA("");
    setAmountB("");
    onOpenChange(false);
  };

  const handleError = (error: Error) => {
    toast.error(simplifyErrorMessage(error, "Deposit failed"));
  };

  const { deposit, isDepositing } = useDeposit(
    doxxAmmProgram,
    wallet,
    handleSuccess,
    handleError,
  );

  const handleDeposit = async () => {
    if (
      !poolState ||
      !poolStateAddress ||
      !tokenA ||
      !tokenB ||
      !amountA ||
      !amountB ||
      !doxxAmmProgram
    ) {
      toast.error("Please enter amounts for both tokens");
      return;
    }

    try {
      // IMPORTANT: tokenA/tokenB in UI might not match token0/token1 in pool
      // poolState.token0Mint is always < token1Mint (sorted by public key)
      // We need to map our UI amounts to the correct pool tokens

      // Check which UI token corresponds to which pool token
      const isTokenAToken0 = poolState.token0Mint.toBase58() === tokenA.address;

      // Map amounts correctly
      const actualAmount0 = isTokenAToken0 ? amountA : amountB;
      const actualAmount1 = isTokenAToken0 ? amountB : amountA;
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

      // Use higher slippage tolerance (10%) for safety
      const slippageTolerance = 0.1;
      const maxAmount0 = amount0
        .muln(Math.floor(100 * (1 + slippageTolerance)))
        .divn(100);
      const maxAmount1 = amount1
        .muln(Math.floor(100 * (1 + slippageTolerance)))
        .divn(100);

      console.log("Depositing to pool:", {
        poolStateAddress,
        uiTokenA: tokenA.symbol,
        uiTokenB: tokenB.symbol,
        uiAmountA: amountA,
        uiAmountB: amountB,
        poolToken0: poolState.token0Mint.toBase58(),
        poolToken1: poolState.token1Mint.toBase58(),
        isTokenAToken0,
        actualAmount0,
        actualAmount1,
        lpAmount: lpAmount.toString(),
        maxAmount0: maxAmount0.toString(),
        maxAmount1: maxAmount1.toString(),
        slippage: `${slippageTolerance * 100}%`,
      });

      await deposit({
        poolState: new PublicKey(poolStateAddress),
        token0Mint: poolState.token0Mint,
        token1Mint: poolState.token1Mint,
        lpMint: poolState.lpMint,
        token0Vault: poolState.token0Vault,
        token1Vault: poolState.token1Vault,
        token0Program: poolState.token0Program,
        token1Program: poolState.token1Program,
        lpTokenAmount: lpAmount,
        maximumToken0Amount: maxAmount0,
        maximumToken1Amount: maxAmount1,
      });
    } catch (error) {
      console.error("Deposit error:", error);
      // Error is already handled by handleError callback
    }
  };

  const isDepositEnabled =
    tokenA &&
    tokenB &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    !isDepositing;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[480px] w-[640px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle>Deposit</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col justify-between gap-1 p-6">
            {/* Token Input Rows */}
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-1">
                <div className="h-full w-full rounded-tl-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenA}
                    amount={amountA}
                    placeholder="-0.00"
                    label={tokenA?.symbol || "Token A"}
                    onTokenSelect={() => {}} // Disabled for deposit
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountA)
                    }
                    balance={tokenBalances.tokenA}
                    usdValue={usdValues.tokenA}
                    disableTokenSelect={true}
                  />
                </div>

                <div className="h-full w-full rounded-tr-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenB}
                    amount={amountB}
                    placeholder="-0.00"
                    label={tokenB?.symbol || "Token B"}
                    onTokenSelect={() => {}} // Disabled for deposit
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountB)
                    }
                    balance={tokenBalances.tokenB}
                    usdValue={usdValues.tokenB}
                    disableTokenSelect={true}
                  />
                </div>
              </div>

              <div className="h-full w-full rounded-b-xl bg-gray-800 p-4">
                <div className="relative flex items-center justify-center">
                  <div className="absolute -top-8 flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 bg-gray-900">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 3V13M8 13L4 9M8 13L12 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-gray-400"
                      />
                    </svg>
                  </div>
                </div>

                {/* LP Token Info - Display Only */}
                <div className="flex w-full flex-col gap-2 py-2 pt-6">
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      {tokenA && tokenB
                        ? `${tokenA.symbol} / ${tokenB.symbol}`
                        : "Select / Select"}
                    </span>
                    <span className={cn(text.sh1(), "text-gray-300")}>
                      +{lpTokenAmount || "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      Balance: 0
                    </span>
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      ${usdValues.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overview Section */}
            <div className="flex flex-col gap-2 pt-4">
              <h3 className={cn(text.sb2(), "text-gray-400")}>Overview</h3>

              <div className="flex items-center justify-between">
                <span className={cn(text.sb3(), "text-gray-400")}>
                  Share of pool
                </span>
                <span className={cn(text.sb3(), "text-gray-300")}>
                  {shareOfPool.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={cn(text.sb3(), "text-gray-400")}>
                  Earned fees
                </span>
                <span className={cn(text.sb3(), "text-gray-300")}>
                  {earnedFees.toFixed(2)}%
                </span>
              </div>
            </div>

            <div />
            {/* Deposit Button */}
            <Button
              className={cn(
                "h-12 w-full rounded-xl",
                isDepositEnabled
                  ? "bg-green hover:bg-green/90 text-black"
                  : "cursor-not-allowed bg-gray-700 text-gray-400",
              )}
              onClick={handleDeposit}
              disabled={!isDepositEnabled}
            >
              <span className={cn(text.hsb2())}>
                {isDepositing ? "Depositing..." : "Deposit"}
              </span>
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
