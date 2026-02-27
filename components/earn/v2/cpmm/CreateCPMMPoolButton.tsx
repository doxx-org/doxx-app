import { useCallback, useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { CreatePoolSuccessToast } from "@/components/toast/CreatePool";
import { TokenProfile } from "@/lib/config/tokens";
import { useCreateCPMMPool } from "@/lib/hooks/chain/useCreateCPMMPool";
import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useRaydium } from "@/lib/hooks/chain/useRaydium";
import { text } from "@/lib/text";
import {
  getAmmConfigAddress,
  parseAmountBN,
  simplifyErrorMessage,
} from "@/lib/utils";
import { cn } from "@/lib/utils/style";
import { Button } from "../../../ui/button";
import { ConnectButtonWrapper } from "../../../wallet/ConnectButtonWrapper";
import { getFeeTiers } from "../../FeeTierSelection";

const feeTiers = getFeeTiers("cpmm");

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

  const { data: raydium } = useRaydium({ connection, wallet });

  const {
    createPool,
    isCreating: isCreatingPool,
    // createError: createPoolError,
  } = useCreateCPMMPool(
    raydium,
    doxxAmmProgram,
    wallet,
    handleSuccess,
    handleError,
  );

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

      // Convert amounts to BN with proper decimals
      const initAmount0 = parseAmountBN(amountA, tokenA.decimals);
      const initAmount1 = parseAmountBN(amountB, tokenB.decimals);

      console.log("Creating pool with:", {
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        amountA,
        amountB,
        feeIndex: selectedFeeIndex,
        feeTier: feeTiers[selectedFeeIndex].fee + "%",
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

    return ["Create", false, handleCreatePool];
  }, [
    isPoolExists,
    tokenA,
    tokenB,
    amountA,
    amountB,
    handleCreatePool,
    isCreatingPool,
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
