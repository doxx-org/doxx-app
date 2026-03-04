import { useCallback, useState } from "react";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  Raydium as CpmmRaydium,
} from "@doxxorg/cpmm-sdk";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  buildCpmmSwapExecuteBaseIn,
  buildCpmmSwapExecuteBaseOut,
} from "@/lib/utils/routingV2";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";

type CpmmSwapBaseInParams = {
  inputMint: PublicKey;
  amountIn: BN;
  minAmountOut: BN;
};

type CpmmSwapBaseOutParams = {
  inputMint: PublicKey;
  amountOut: BN;
  maxAmountIn: BN;
};

interface IDoxxCpmmSwapV2Params {
  cpmmRaydium: CpmmRaydium | undefined;
  poolInfo: ApiV3PoolInfoStandardItemCpmm | undefined;
  poolKeys: CpmmKeys | undefined;
  wallet: AnchorWallet | undefined;
  onSuccess: (tx?: string) => void;
  onError: (e: Error, txSignature?: string) => void;
}

export function useDoxxCpmmSwapV2({
  cpmmRaydium,
  poolInfo,
  poolKeys,
  wallet,
  onSuccess,
  onError,
}: IDoxxCpmmSwapV2Params) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<Error | undefined>();

  const swapBaseIn = useCallback(
    async (params: CpmmSwapBaseInParams) => {
      setIsSwapping(true);
      setSwapError(undefined);

      if (!cpmmRaydium || !wallet?.publicKey || !poolInfo || !poolKeys) {
        const err = new Error("Missing required parameters for CPMM swap");
        setSwapError(err);
        setIsSwapping(false);
        return undefined;
      }

      try {
        const { execute } = await buildCpmmSwapExecuteBaseIn({
          cpmmRaydium,
          wallet,
          amountIn: params.amountIn,
          minAmountOut: params.minAmountOut,
          inputMint: params.inputMint,
          poolInfo,
          poolKeys,
        });

        const { txId } = await execute({ sendAndConfirm: true });

        const status = await pollSignatureStatus({
          connection: cpmmRaydium.connection,
          signature: txId,
          timeoutMs: 120_000,
        });

        if (!status) {
          const err = new Error("Transaction not found on chain");
          onError(err, txId);
          setSwapError(err);
          setIsSwapping(false);
          return undefined;
        }

        onSuccess(txId);
        setIsSwapping(false);
        return txId;
      } catch (e) {
        console.log("🚀 ~ CPMM swapBaseIn error:", e);
        const err = e instanceof Error ? e : new Error("Unknown error");
        onError(err);
        setSwapError(err);
        setIsSwapping(false);
        return undefined;
      }
    },
    [cpmmRaydium, wallet, poolInfo, poolKeys, onSuccess, onError],
  );

  const swapBaseOut = useCallback(
    async (params: CpmmSwapBaseOutParams) => {
      setIsSwapping(true);
      setSwapError(undefined);

      if (!cpmmRaydium || !wallet?.publicKey || !poolInfo || !poolKeys) {
        const err = new Error("Missing required parameters for CPMM swap");
        setSwapError(err);
        setIsSwapping(false);
        return undefined;
      }

      try {
        const { execute } = await buildCpmmSwapExecuteBaseOut({
          cpmmRaydium,
          wallet,
          maxAmountIn: params.maxAmountIn,
          amountOut: params.amountOut,
          inputMint: params.inputMint,
          poolInfo,
          poolKeys,
        });

        const { txId } = await execute({ sendAndConfirm: true });

        const status = await pollSignatureStatus({
          connection: cpmmRaydium.connection,
          signature: txId,
          timeoutMs: 120_000,
        });

        if (!status) {
          const err = new Error("Transaction not found on chain");
          onError(err, txId);
          setSwapError(err);
          setIsSwapping(false);
          return undefined;
        }

        onSuccess(txId);
        setIsSwapping(false);
        return txId;
      } catch (e) {
        console.log("🚀 ~ CPMM swapBaseOut error:", e);
        const err = e instanceof Error ? e : new Error("Unknown error");
        onError(err);
        setSwapError(err);
        setIsSwapping(false);
        return undefined;
      }
    },
    [cpmmRaydium, wallet, poolInfo, poolKeys, onSuccess, onError],
  );

  return {
    swapBaseIn,
    swapBaseOut,
    isSwapping,
    swapError,
  };
}
