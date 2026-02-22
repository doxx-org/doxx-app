import { useCallback, useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { CreatePoolSuccessToast } from "@/components/toast/CreatePool";
import { CheckSignatureTimeoutToast } from "@/components/toast/Toast";
import { TokenProfile } from "@/lib/config/tokens";
import { useCreateClmmPoolAndPosition } from "@/lib/hooks/chain/useCreateClmmPoolAndPosition";
import { useDoxxClmmProgram } from "@/lib/hooks/chain/useDoxxClmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { text } from "@/lib/text";
import { simplifyErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils/style";
import { Button } from "../../../ui/button";
import { ConnectButtonWrapper } from "../../../wallet/ConnectButtonWrapper";
import { PriceMode } from "../types";

interface CreateCLMMPoolButtonProps {
  tokenA: TokenProfile | null;
  tokenB: TokenProfile | null;
  amountA: string;
  amountB: string;
  initialPrice: string;
  priceMode: PriceMode;
  minPrice: string;
  maxPrice: string;
  // onSelectTokenA: (token: TokenProfile | null) => void;
  onSelectTokenB: (token: TokenProfile | null) => void;
  onAmountChangeA: (amount: string) => void;
  onAmountChangeB: (amount: string) => void;
  onInitialPriceChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  selectedFeeIndex: number;
  isPoolExists: boolean | undefined;
}

export const CreateCLMMPoolButton = ({
  tokenA,
  tokenB,
  amountA,
  amountB,
  initialPrice,
  priceMode,
  minPrice,
  maxPrice,
  // onSelectTokenA,
  onSelectTokenB,
  onAmountChangeA,
  onAmountChangeB,
  onInitialPriceChange,
  onOpenChange,
  selectedFeeIndex,
  isPoolExists,
}: CreateCLMMPoolButtonProps) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxClmmProgram = useDoxxClmmProgram({ provider });

  const handleSuccess = (txSignature: string | undefined) => {
    if (txSignature) {
      toast.success(<CreatePoolSuccessToast txSignature={txSignature} />);
    } else {
      toast.success("Pool created successfully!");
    }

    // Reset form
    // onSelectTokenA(null);
    onSelectTokenB(null);
    onAmountChangeA("");
    onAmountChangeB("");
    onInitialPriceChange("");
    onOpenChange(false);
  };

  const handleError = (error: Error, txSignature?: string) => {
    if (error.message === "TransactionNotFoundOnChain" && txSignature) {
      toast.error(<CheckSignatureTimeoutToast signature={txSignature} />);
    } else {
      toast.error(simplifyErrorMessage(error, "Pool creation failed"));
    }
  };

  const { createPoolAndPosition, isCreating: isCreatingPool } =
    useCreateClmmPoolAndPosition(
      connection,
      doxxClmmProgram,
      wallet,
      handleSuccess,
      handleError,
    );

  const hasValidRange =
    priceMode === PriceMode.FULL
      ? true
      : minPrice !== "" &&
        maxPrice !== "" &&
        parseFloat(minPrice) > 0 &&
        parseFloat(maxPrice) > 0;

  const isCreatePoolEnabled =
    tokenA &&
    tokenB &&
    initialPrice &&
    parseFloat(initialPrice) > 0 &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    hasValidRange &&
    !isCreatingPool;

  const handleCreatePool = useCallback(async () => {
    if (!tokenA || !tokenB || !initialPrice || !amountA || !amountB) {
      toast.error(
        "Please select both tokens and enter price + deposit amounts",
      );
      return;
    }

    // Create pool + initial position (liquidity) in one tx
    await createPoolAndPosition({
      selectedFeeIndex,
      tokenAMint: new PublicKey(tokenA.address),
      tokenBMint: new PublicKey(tokenB.address),
      tokenADecimals: tokenA.decimals,
      tokenBDecimals: tokenB.decimals,
      initialPriceAperB: initialPrice,
      amountA,
      amountB,
      priceMode,
      minPriceAperB: minPrice,
      maxPriceAperB: maxPrice,
    });
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    initialPrice,
    priceMode,
    minPrice,
    maxPrice,
    selectedFeeIndex,
    createPoolAndPosition,
  ]);

  const [label, disabled, handleCreateCLMMPoolButton] = useMemo(() => {
    if (
      tokenA === null ||
      tokenB === null ||
      amountA === "" ||
      amountB === "" ||
      !hasValidRange ||
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
    tokenA,
    tokenB,
    amountA,
    amountB,
    hasValidRange,
    isPoolExists,
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
        onClick={handleCreateCLMMPoolButton}
        disabled={disabled}
      >
        <span className={cn(text.hsb2())}>{label}</span>
      </Button>
    </ConnectButtonWrapper>
  );
};
