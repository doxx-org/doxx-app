import { useCallback, useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { CreatePoolSuccessToast } from "@/components/toast/CreatePool";
import { TokenProfile } from "@/lib/config/tokens";
import { useCreatePool } from "@/lib/hooks/chain/useCreatePool";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { text } from "@/lib/text";
import {
  getAmmConfigAddress,
  parseAmountBN,
  simplifyErrorMessage,
} from "@/lib/utils";
import { cn } from "@/lib/utils/style";
import { Button } from "../../../ui/button";
import { ConnectButtonWrapper } from "../../../wallet/ConnectButtonWrapper";
import { FEE_TIERS } from "../../FeeTierSelection";

interface CreatePoolButtonProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  amountA: string;
  amountB: string;
  onSelectTokenA: (token: TokenProfile | null) => void;
  onSelectTokenB: (token: TokenProfile | null) => void;
  onAmountChangeA: (amount: string) => void;
  onAmountChangeB: (amount: string) => void;
  onOpenChange: (open: boolean) => void;
  selectedFeeIndex: number;
  isPoolExists: boolean | undefined;
}

export const CreatePoolButton = ({
  tokenA,
  tokenB,
  amountA,
  amountB,
  onSelectTokenA,
  onSelectTokenB,
  onAmountChangeA,
  onAmountChangeB,
  onOpenChange,
  selectedFeeIndex,
  isPoolExists,
}: CreatePoolButtonProps) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxCpmmProgram({ provider });

  const handleSuccess = (txSignature: string | undefined) => {
    if (txSignature) {
      toast.success(<CreatePoolSuccessToast txSignature={txSignature} />);
    } else {
      toast.success("Pool created successfully!");
    }

    // Reset form
    onSelectTokenA(null);
    onSelectTokenB(null);
    onAmountChangeA("");
    onAmountChangeB("");
    onOpenChange(false);
  };

  const handleError = (error: Error) => {
    toast.error(simplifyErrorMessage(error, "Pool creation failed"));
  };

  const {
    createPool,
    isCreating: isCreatingPool,
    // createError: createPoolError,
  } = useCreatePool(doxxAmmProgram, wallet, handleSuccess, handleError);

  const isCreatePoolEnabled =
    tokenA &&
    tokenB &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    !isCreatingPool;

  const handleCreatePool = useCallback(async () => {
    if (!tokenA || !tokenB || !amountA || !amountB || !doxxAmmProgram) {
      toast.error("Please select both tokens and enter amounts");
      return;
    }

    try {
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
      // console.log("Using fee account:", addressConfig.contracts.createPoolFee);

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
        ammConfig: ammConfig,
        token0Mint: new PublicKey(tokenA.address),
        token1Mint: new PublicKey(tokenB.address),
        initAmount0,
        initAmount1,
      });
    } catch (error) {
      console.log("Pool creation error:", error);
      // Error is already handled by handleError callback
    }
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    doxxAmmProgram,
    selectedFeeIndex,
    createPool,
  ]);

  const [label, disabled, handleCreatePoolButton] = useMemo(() => {
    if (
      tokenA === null ||
      tokenB === null ||
      amountA === "" ||
      amountB === "" ||
      isPoolExists === undefined
    ) {
      return ["Create", true, undefined];
    }

    if (isPoolExists) {
      return ["Pool already exists", true, undefined];
    }

    if (isCreatingPool) {
      return ["Creating...", true, undefined];
    }

    // const poolData = poolsData.find((c) => {
    //   console.log(
    //     "🚀 ~ c.ammConfig.tradeFeeRate:",
    //     c.ammConfig.tradeFeeRate.toString(),
    //   );
    //   return (
    //     ((c.poolState.token0Mint.toString() === tokenA.address &&
    //       c.poolState.token1Mint.toString() === tokenB.address) ||
    //       (c.poolState.token1Mint.toString() === tokenA.address &&
    //         c.poolState.token0Mint.toString() === tokenB.address)) &&
    //     c.ammConfig.tradeFeeRate.eq(
    //       new BN(FEE_TIERS[selectedFeeIndex].fee * 100),
    //     )
    //   );
    // });

    // if (poolData) {
    //   return ["Pool already exists", true, undefined];
    // }

    // if (createPoolError) {
    //   return ["Error creating Pool", true, undefined];
    // }

    return ["Create", false, handleCreatePool];
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    handleCreatePool,
    isCreatingPool,
    selectedFeeIndex,
    // createPoolError,
  ]);

  return (
    <ConnectButtonWrapper
      className={cn(text.hsb1(), "h-16 w-full rounded-xl p-6")}
    >
      <Button
        className={cn(
          "h-12 w-full rounded-xl",
          isCreatePoolEnabled || !disabled
            ? "bg-green hover:bg-green/90 text-black"
            : "cursor-not-allowed bg-gray-700 text-gray-400",
        )}
        loading={isCreatingPool}
        onClick={handleCreatePoolButton}
        disabled={disabled}
      >
        <span className={cn(text.hsb2())}>{label}</span>
      </Button>
    </ConnectButtonWrapper>
  );
};
