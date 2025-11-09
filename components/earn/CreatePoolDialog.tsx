"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { addressConfig } from "@/lib/config/addresses";
import { TokenProfile, knownTokenProfiles } from "@/lib/config/tokens";
import { useCreatePool } from "@/lib/hooks/chain/useCreatePool";
import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { text } from "@/lib/text";
import { cn, simplifyErrorMessage } from "@/lib/utils";
import { getAmmConfigAddress } from "@/lib/utils/instructions";
import { parseAmountBN } from "@/lib/utils/number";
import { TokenSelectorDialog } from "../swap/TokenSelectorDialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { TokenSelectionRow } from "./TokenSelectionRow";

interface CreatePoolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

enum SelectTokenType {
  TOKEN_A,
  TOKEN_B,
}

// Fee tier configuration matching the AMM program's config indexes
const FEE_TIERS = [
  {
    index: 0,
    fee: 0.01,
    label: "0.01% fee",
    description: "Best for very stable pairs",
  },
  {
    index: 1,
    fee: 0.05,
    label: "0.05% fee",
    description: "Best for stable pairs",
  },
  { index: 2, fee: 0.3, label: "0.3% fee", description: "Best for most pairs" },
  {
    index: 3,
    fee: 1.0,
    label: "1.0% fee",
    description: "Best for exotic pairs",
  },
];

export const CreatePoolDialog = ({
  isOpen,
  onOpenChange,
}: CreatePoolDialogProps) => {
  const [tokenA, setTokenA] = useState<TokenProfile | null>(null);
  const [tokenB, setTokenB] = useState<TokenProfile | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState<SelectTokenType>(
    SelectTokenType.TOKEN_A,
  );
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);
  const [isFeeSelectionOpen, setIsFeeSelectionOpen] = useState(false);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });

  // Fetch token balances
  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    knownTokenProfiles,
  );

  // Memoized calculations
  const lpTokenAmount = useMemo((): string => {
    if (
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

    // For initial liquidity provision, LP tokens = sqrt(amount0 * amount1)
    // This is the Uniswap V2 constant product formula
    // Note: amounts are already in human-readable format, so we use them directly
    const lpAmount = Math.sqrt(numAmountA * numAmountB);

    // Format to 6 decimal places for display
    return lpAmount.toFixed(6);
  }, [tokenA, tokenB, amountA, amountB]);

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
      if (!token) return 0;
      // Placeholder prices - in a real app, these would come from a price API
      const mockPrices: Record<string, number> = {
        USDC: 1.0,
        sUSD: 1.0,
        LAYER: 0.05, // Example price
        sSOL: 180.0, // Example price
      };
      return mockPrices[token.address] ?? 0;
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

  const handleSelectToken = (token: TokenProfile) => {
    if (selectedTokenType === SelectTokenType.TOKEN_A) {
      // If token B is the same as the new token A, clear it
      if (tokenB?.symbol === token.symbol) {
        setTokenB(null);
        setAmountB("");
      }
      setTokenA(token);
    } else if (selectedTokenType === SelectTokenType.TOKEN_B) {
      // If token A is the same as the new token B, clear it
      if (tokenA?.symbol === token.symbol) {
        setTokenA(null);
        setAmountA("");
      }
      setTokenB(token);
    }
    setIsTokenSelectorOpen(false);
  };

  const handleAmountChange = (
    value: string,
    setAmount: (value: string) => void,
  ) => {
    // Allow empty string, numbers, and decimal points
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleOpenTokenSelector = (tokenType: SelectTokenType) => {
    setSelectedTokenType(tokenType);
    setIsTokenSelectorOpen(true);
  };

  const handleSuccess = (txSignature: string | undefined) => {
    if (txSignature) {
      toast.success(
        `Pool created successfully! TX: ${txSignature.slice(0, 8)}...`,
      );
    } else {
      toast.success("Pool created successfully!");
    }

    // Reset form
    setTokenA(null);
    setTokenB(null);
    setAmountA("");
    setAmountB("");
    onOpenChange(false);
  };

  const handleError = (error: Error) => {
    toast.error(simplifyErrorMessage(error, "Pool creation failed"));
  };

  const { createPool, isCreating } = useCreatePool(
    doxxAmmProgram,
    wallet,
    handleSuccess,
    handleError,
  );

  const handleCreatePool = async () => {
    if (!tokenA || !tokenB || !amountA || !amountB || !doxxAmmProgram) {
      toast.error("Please select both tokens and enter amounts");
      return;
    }

    try {
      // Get AMM config for selected fee tier
      const [ammConfig] = getAmmConfigAddress(
        selectedFeeIndex,
        doxxAmmProgram.programId,
      );
      console.log(
        "Using AMM config index:",
        selectedFeeIndex,
        "Address:",
        ammConfig.toBase58(),
      );

      // Verify AMM config exists
      try {
        const configAccount =
          await doxxAmmProgram.account.ammConfig.fetch(ammConfig);
        console.log("AMM Config found:", {
          index: configAccount.index,
          tradeFeeRate: configAccount.tradeFeeRate.toString(),
          disableCreatePool: configAccount.disableCreatePool,
        });

        if (configAccount.disableCreatePool) {
          toast.error("Pool creation is disabled for this fee tier");
          return;
        }
      } catch (configError) {
        console.error("AMM Config fetch error:", configError);
        toast.error(
          `AMM Config for fee tier ${FEE_TIERS[selectedFeeIndex].fee}% does not exist on-chain. Please select a different fee tier.`,
        );
        return;
      }

      // Note: Fee account may not exist until first pool is created - this is normal
      console.log("Using fee account:", addressConfig.contracts.createPoolFee);

      // Convert amounts to BN with proper decimals
      const initAmount0 = parseAmountBN(amountA, tokenA.decimals);
      const initAmount1 = parseAmountBN(amountB, tokenB.decimals);

      console.log("Creating pool with:", {
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        amountA,
        amountB,
        feeIndex: selectedFeeIndex,
        feeTier: FEE_TIERS[selectedFeeIndex].fee + "%",
        ammConfig: ammConfig.toBase58(),
        initAmount0: initAmount0.toString(),
        initAmount1: initAmount1.toString(),
      });

      await createPool({
        ammConfig,
        token0Mint: new PublicKey(tokenA.address),
        token1Mint: new PublicKey(tokenB.address),
        initAmount0,
        initAmount1,
      });
    } catch (error) {
      console.error("Pool creation error:", error);
      // Error is already handled by handleError callback
    }
  };

  const isCreatePoolEnabled =
    tokenA &&
    tokenB &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    !isCreating;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[480px] w-[640px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle>Create Pool</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col justify-between gap-1 p-6">
            {/* Token Selection Rows */}
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-1">
                <div className="h-full w-full rounded-tl-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenA}
                    amount={amountA}
                    placeholder="0.00"
                    label="Token A"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_A)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountA)
                    }
                    balance={tokenBalances.tokenA}
                    usdValue={usdValues.tokenA}
                  />
                </div>

                <div className="h-full w-full rounded-tr-xl bg-gray-800 p-2">
                  <TokenSelectionRow
                    token={tokenB}
                    amount={amountB}
                    placeholder="0.00"
                    label="Token B"
                    onTokenSelect={() =>
                      handleOpenTokenSelector(SelectTokenType.TOKEN_B)
                    }
                    onAmountChange={(value) =>
                      handleAmountChange(value, setAmountB)
                    }
                    balance={tokenBalances.tokenB}
                    usdValue={usdValues.tokenB}
                  />
                </div>
              </div>

              <div className="h-full w-full rounded-b-xl bg-gray-800 p-2">
                {/* LP Token Info - Display Only */}
                <div className="flex w-full flex-col gap-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      LP Token
                    </span>
                    <span className={cn(text.b3(), "text-gray-300")}>
                      {tokenA && tokenB
                        ? `${tokenA.symbol} / ${tokenB.symbol}`
                        : "Select tokens"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      LP Amount
                    </span>
                    <span className={cn(text.sh1(), "text-gray-300")}>
                      {lpTokenAmount || "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      Total Value
                    </span>
                    <span className={cn(text.sb3(), "text-gray-500")}>
                      $
                      {usdValues.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fee Selection Section */}
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className={cn(text.sb2(), "text-gray-400")}>Select Pool</h3>
              </div>
              <p className={cn(text.sb3(), "text-gray-500")}>
                Select a pool type based on your preferred liquidity provider
                fee.
              </p>

              {/* Fee Tier Selector */}
              <button
                onClick={() => setIsFeeSelectionOpen(!isFeeSelectionOpen)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 transition-colors hover:bg-gray-700/50",
                )}
              >
                <span className={cn(text.b3(), "text-gray-300")}>
                  Select a fee tier
                </span>
                <div className="flex items-center gap-2">
                  {isFeeSelectionOpen && (
                    <span className={cn(text.sb3(), "text-gray-400")}>
                      Hide
                    </span>
                  )}
                  {isFeeSelectionOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Fee Tier Options */}
              {isFeeSelectionOpen && (
                <div className="grid grid-cols-2 gap-3">
                  {FEE_TIERS.map((tier) => (
                    <button
                      key={tier.index}
                      onClick={() => {
                        setSelectedFeeIndex(tier.index);
                        setIsFeeSelectionOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-4 transition-all",
                        selectedFeeIndex === tier.index
                          ? "border-green bg-green/10"
                          : "border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-700/30",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span
                          className={cn(text.b3(), "font-semibold text-white")}
                        >
                          {tier.label}
                        </span>
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border-2",
                            selectedFeeIndex === tier.index
                              ? "border-green"
                              : "border-gray-600",
                          )}
                        >
                          {selectedFeeIndex === tier.index && (
                            <div className="bg-green h-3 w-3 rounded-full" />
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(text.sb3(), "text-left text-gray-500")}
                      >
                        {tier.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div />
            {/* Create Pool Button */}
            <Button
              className={cn(
                "h-12 w-full rounded-xl",
                isCreatePoolEnabled
                  ? "bg-green hover:bg-green/90 text-black"
                  : "cursor-not-allowed bg-gray-700 text-gray-400",
              )}
              onClick={handleCreatePool}
              disabled={!isCreatePoolEnabled}
            >
              <span className={cn(text.hsb2())}>
                {isCreating ? "Creating Pool..." : "Create Pool"}
              </span>
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Token Selector Dialog */}
      <TokenSelectorDialog
        isOpen={isTokenSelectorOpen}
        onOpenChange={setIsTokenSelectorOpen}
        tokenProfiles={knownTokenProfiles}
        onSelectToken={handleSelectToken}
      />
    </>
  );
};
