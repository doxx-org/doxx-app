// useDoxxSwapV2.ts
import { useCallback, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { PoolState } from "@/lib/hooks/chain/types";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import { getPoolAddress } from "@/lib/utils/instructions";

type SwapBaseInputParams = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: BN; // in token decimals format
  minOut: BN; // in token decimals format
};

type SwapBaseOutputParams = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  maxAmountIn: BN; // human
  amountOut: BN; // human
};

export function useDoxxSwap(
  program: Program<DoxxAmm> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error) => void,
) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<Error | undefined>();

  // ---------- core builder (single-hop) ----------
  const buildAndSendSwap = useCallback(
    async ({
      pool,
      params,
      kind, // "in" | "out"
    }: {
      pool: PoolState;
      params: SwapBaseInputParams | SwapBaseOutputParams;
      kind: "in" | "out";
    }) => {
      setIsSwapping(true);
      setSwapError(undefined);

      if (!program || !wallet?.publicKey) {
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

      try {
        const inputMint = params.inputMint as PublicKey;
        const outputMint = params.outputMint as PublicKey;
        const inIs0 = inputMint.equals(pool.token0Mint);

        const inputVault = inIs0 ? pool.token0Vault : pool.token1Vault;
        const outputVault = inIs0 ? pool.token1Vault : pool.token0Vault;
        const inputTokenProgram = inIs0
          ? pool.token0Program
          : pool.token1Program;
        const outputTokenProgram = inIs0
          ? pool.token1Program
          : pool.token0Program;

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

        // idempotent ATA creations if needed:
        const ataIxs = [
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            inputTokenAccount,
            wallet.publicKey,
            inputMint,
            inputTokenProgram,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            outputTokenAccount,
            wallet.publicKey,
            outputMint,
            outputTokenProgram,
          ),
        ];

        const cuIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
        ];

        const poolAddress = (() => {
          // If your UI already has the PDA, you can pass it in; otherwise derive
          try {
            const [addr] = getPoolAddress(
              pool.ammConfig,
              pool.token0Mint,
              pool.token1Mint,
              program.programId,
            );
            return addr;
          } catch {
            setSwapError(new Error("Pool PDA unavailable"));
            return undefined;
          }
        })();
        if (!poolAddress) return undefined;

        let ix;
        if (kind === "in") {
          const amountInBN = (params as SwapBaseInputParams).amountIn;
          const minOutBN = (params as SwapBaseInputParams).minOut;
          ix = await program.methods
            .swapBaseInput(amountInBN, minOutBN)
            .accounts({
              payer: wallet.publicKey,
              ammConfig: pool.ammConfig,
              poolState: poolAddress,
              inputTokenAccount,
              outputTokenAccount,
              inputVault,
              outputVault,
              inputTokenProgram,
              outputTokenProgram,
              inputTokenMint: inputMint,
              outputTokenMint: outputMint,
              observationState: pool.observationKey,
            })
            .instruction();
        } else {
          const maxInBN = (params as SwapBaseOutputParams).maxAmountIn;
          const amountOutBN = (params as SwapBaseOutputParams).amountOut;
          ix = await program.methods
            .swapBaseOutput(maxInBN, amountOutBN)
            .accounts({
              payer: wallet.publicKey,
              ammConfig: pool.ammConfig,
              poolState: poolAddress,
              inputTokenAccount,
              outputTokenAccount,
              inputVault,
              outputVault,
              inputTokenProgram,
              outputTokenProgram,
              inputTokenMint: inputMint,
              outputTokenMint: outputMint,
              observationState: pool.observationKey,
            })
            .instruction();
        }

        const tx = new Transaction().add(...cuIxs, ...ataIxs, ix);
        const sig = await provider.sendAndConfirm?.(tx, []);
        onSuccess(sig);
        setIsSwapping(false);
        return sig;
      } catch (e) {
        console.log("🚀 ~ e:", e);
        onError(e as Error);
        setSwapError(
          new Error(e instanceof Error ? e.message : "Unknown error"),
        );
        setIsSwapping(false);
        return undefined;
      }
    },
    [program, wallet, onSuccess, onError],
  );

  const swapBaseInput = useCallback(
    (pool: PoolState, params: SwapBaseInputParams) =>
      buildAndSendSwap({ pool, params, kind: "in" }),
    [buildAndSendSwap],
  );

  const swapBaseOutput = useCallback(
    (pool: PoolState, params: SwapBaseOutputParams) =>
      buildAndSendSwap({ pool, params, kind: "out" }),
    [buildAndSendSwap],
  );

  return {
    swapBaseInput,
    swapBaseOutput,
    isSwapping,
    swapError,
  };
}
