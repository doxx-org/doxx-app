import { useCallback, useMemo, useState } from "react";
import { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
  parseAmountBN,
  toBN,
} from "@/lib/utils";
import { getPoolAddress } from "@/lib/utils/instructions";
import { PoolState } from "./types";

type SwapBaseInputParams = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  // amounts
  amountIn: string;
  minOut: string;
};

type SwapBaseOutputParams = Omit<SwapBaseInputParams, "amountIn" | "minOut"> & {
  maxAmountIn: string;
  amountOut: string;
};

/** Compose and send swap txns */
export function useDoxxSwap(
  program: Program<DoxxAmm> | undefined,
  wallet: AnchorWallet | undefined,
  poolState: PoolState | undefined,
  onSuccess: (txSignature: string | undefined) => void,
  onError: (error: Error) => void,
) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<Error | undefined>(undefined);

  const poolAddress = useMemo(() => {
    if (!poolState || !program) return undefined;

    try {
      const [address] = getPoolAddress(
        poolState.ammConfig,
        poolState.token0Mint,
        poolState.token1Mint,
        program.programId,
      );
      return address;
    } catch (error) {
      setSwapError(
        new Error(error instanceof Error ? error.message : "Unknown error"),
      );
      return undefined;
    }
  }, [poolState, program]);

  const swapBaseInput = useCallback(
    async (swapBaseInputParams: SwapBaseInputParams) => {
      setIsSwapping(true);
      setSwapError(undefined);

      if (!program || !wallet?.publicKey || !poolState || !poolAddress) {
        setIsSwapping(false);
        setSwapError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider) {
        return undefined;
      }

      // Identify input/output mints & vaults
      const inputMint = swapBaseInputParams.inputMint;
      const outputMint = swapBaseInputParams.outputMint;

      const inputVault = poolState.token0Vault;
      const outputVault = poolState.token1Vault;
      const inputTokenProgram = poolState.token0Program;
      const outputTokenProgram = poolState.token1Program;

      const ammConfigPk = poolState.ammConfig;
      const observationPk = poolState.observationKey;

      try {
        const inputTokenAccount = getAssociatedTokenAddressSync(
          inputMint,
          wallet.publicKey,
          false,
          inputTokenProgram,
        );

        const outputTokenAccount = getAssociatedTokenAddressSync(
          outputMint,
          wallet.publicKey,
          false,
          outputTokenProgram,
        );

        const amountInBN = parseAmountBN(
          swapBaseInputParams.amountIn,
          poolState.mint0Decimals,
        );

        const ix = await program.methods
          .swapBaseInput(amountInBN, toBN(0)) // TODO: add minOut
          .accounts({
            payer: wallet.publicKey,
            ammConfig: ammConfigPk,
            poolState: poolAddress,
            inputTokenAccount,
            outputTokenAccount,
            inputVault,
            outputVault,
            inputTokenProgram,
            outputTokenProgram,
            inputTokenMint: inputMint,
            outputTokenMint: outputMint,
            observationState: observationPk,
          })
          .instruction();

        const tx = new Transaction().add(ix);

        // open wallet and get confirmation
        const signature = await provider.sendAndConfirm?.(tx, []);

        // swap success
        onSuccess(signature);
        setIsSwapping(false);

        return signature;
      } catch (error) {
        onError(error as Error);
        setSwapError(
          new Error(error instanceof Error ? error.message : "Unknown error"),
        );
        setIsSwapping(false);
        return undefined;
      }
    },
    [program, wallet?.publicKey, poolState, poolAddress, onError, onSuccess],
  );

  const swapBaseOutput = useCallback(
    async (swapBaseOutputParams: SwapBaseOutputParams) => {
      setIsSwapping(true);
      setSwapError(undefined);

      if (!program || !wallet?.publicKey || !poolState || !poolAddress) {
        setIsSwapping(false);
        setSwapError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider) {
        setIsSwapping(false);
        setSwapError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const inputMint = swapBaseOutputParams.inputMint;
      const outputMint = swapBaseOutputParams.outputMint;

      const inputVault = poolState.token0Vault;
      const outputVault = poolState.token1Vault;
      const inputTokenProgram = poolState.token0Program;
      const outputTokenProgram = poolState.token1Program;

      const ammConfigPk = poolState.ammConfig;
      const observationPk = poolState.observationKey;

      try {
        const inputTokenAccount = getAssociatedTokenAddressSync(
          inputMint,
          wallet.publicKey,
          false,
          inputTokenProgram,
        );

        const outputTokenAccount = getAssociatedTokenAddressSync(
          outputMint,
          wallet.publicKey,
          false,
          outputTokenProgram,
        );

        const amountOutBN = parseAmountBN(
          swapBaseOutputParams.amountOut,
          poolState.mint1Decimals,
        );

        const ix = await program.methods
          .swapBaseOutput(
            toBN(0), // TODO: add maxAmountIn
            amountOutBN,
          )
          .accounts({
            payer: wallet.publicKey,
            ammConfig: ammConfigPk,
            poolState: poolAddress,
            inputTokenAccount: inputTokenAccount,
            outputTokenAccount: outputTokenAccount,
            inputVault,
            outputVault,
            inputTokenProgram,
            outputTokenProgram,
            inputTokenMint: inputMint,
            outputTokenMint: outputMint,
            observationState: observationPk,
          })
          .instruction();

        const tx = new Transaction().add(ix);

        const signature = await provider.sendAndConfirm?.(tx, []);

        // swap success
        onSuccess(signature);
        setIsSwapping(false);

        return signature;
      } catch (error) {
        onError(error as Error);
        setSwapError(error as Error);
        setIsSwapping(false);
        return undefined;
      }
    },
    [program, wallet?.publicKey, poolState, poolAddress, onError, onSuccess],
  );

  return { swapBaseInput, swapBaseOutput, isSwapping, swapError };
}
