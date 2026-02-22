import { useCallback, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { DoxxClmmIdl } from "@/lib/idl";
import { diagnoseSwapIssues } from "@/lib/utils";
import {
  buildSwapExecuteBaseIn,
  buildSwapExecuteBaseOut,
} from "@/lib/utils/routingV2";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";

type SwapBaseInputParams = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: BN; // in token decimals format
  minOut: BN; // in token decimals format
};

type SwapBaseOutputParams = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  maxAmountIn: BN; // in token decimals format
  amountOut: BN; // in token decimals format
};

interface IDoxxClmmSwapV2Params {
  raydium: Raydium | undefined;
  // connection: Connection;
  program: Program<DoxxClmmIdl> | undefined;
  poolInfo: ApiV3PoolInfoConcentratedItem | undefined;
  poolKeys: ClmmKeys | undefined;
  remainingAccounts: PublicKey[] | undefined;
  wallet: AnchorWallet | undefined;
  onSuccess: (tx?: string) => void;
  onError: (e: Error, txSignature?: string) => void;
}

export function useDoxxClmmSwapV2({
  // connection,
  program,
  raydium,
  poolInfo,
  poolKeys,
  remainingAccounts,
  wallet,
  onSuccess,
  onError,
}: IDoxxClmmSwapV2Params) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<Error | undefined>();

  const swapBaseIn = useCallback(
    async (params: SwapBaseInputParams) => {
      setIsSwapping(true);
      setSwapError(undefined);
      if (
        !raydium ||
        !wallet?.publicKey ||
        !poolInfo ||
        !poolKeys ||
        !remainingAccounts ||
        !program
      ) {
        setIsSwapping(false);
        setSwapError(new Error("Missing required parameters"));
        return;
      }

      // console.log("🚀 ~ raydium.clmm.logInfo():", raydium.);
      try {
        // Diagnose issues before swapping
        // const diagnosis = await diagnoseSwapIssues({
        //   connection: raydium.connection,
        //   wallet: wallet.publicKey,
        //   inputMint: params.inputMint,
        //   outputMint: params.outputMint,
        //   amountIn: params.amountIn,
        //   poolKeys,
        //   poolInfo,
        //   programId: new PublicKey(poolInfo.programId),
        // });

        // if (!diagnosis.canSwap) {
        //   const errorMsg = "Cannot swap:\n" + diagnosis.issues.join("\n");
        //   console.error(errorMsg);
        //   throw new Error(errorMsg);
        // }

        const { execute } = await buildSwapExecuteBaseIn({
          raydium,
          program,
          wallet,
          amountIn: params.amountIn,
          amountOutMin: params.minOut,
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          poolInfo,
          poolKeys,
          remainingAccounts,
        });

        const { txId } = await execute({ sendAndConfirm: true });

        const status = await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });
        if (!status) {
          onError(new Error("Transaction not found on chain"), txId);
          setIsSwapping(false);
          return;
        }

        onSuccess(txId);
        setIsSwapping(false);

        return txId;
      } catch (error) {
        console.log("🚀 ~ error:", error);
        onError(error as Error);
        setSwapError(error as Error);
        setIsSwapping(false);
        return undefined;
      }
    },
    [
      raydium,
      wallet,
      program,
      poolInfo,
      poolKeys,
      remainingAccounts,
      onSuccess,
      onError,
    ],
  );

  const swapBaseOut = useCallback(
    async (params: SwapBaseOutputParams) => {
      setIsSwapping(true);
      setSwapError(undefined);
      if (
        !raydium ||
        !wallet?.publicKey ||
        !poolInfo ||
        !poolKeys ||
        !remainingAccounts ||
        !program
      ) {
        setIsSwapping(false);
        setSwapError(new Error("Missing required parameters"));
        return;
      }

      try {
        const { execute } = await buildSwapExecuteBaseOut({
          raydium,
          program,
          wallet,
          amountInMax: params.maxAmountIn,
          amountOut: params.amountOut,
          outputMint: params.outputMint,
          inputMint: params.inputMint,
          poolInfo,
          poolKeys,
          remainingAccounts,
        });

        const { txId } = await execute({ sendAndConfirm: true });

        const status = await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });
        if (!status) {
          onError(new Error("Transaction not found on chain"), txId);
          setIsSwapping(false);
          return;
        }

        onSuccess(txId);
        setIsSwapping(false);

        return txId;
      } catch (error) {
        console.log("🚀 ~ error:", error);
        onError(error as Error);
        setSwapError(error as Error);
        setIsSwapping(false);
        return undefined;
      }
    },
    [
      raydium,
      wallet,
      poolInfo,
      poolKeys,
      remainingAccounts,
      program,
      onSuccess,
      onError,
    ],
  );

  return {
    isSwapping,
    swapError,
    swapBaseIn,
    swapBaseOut,
  };
}
