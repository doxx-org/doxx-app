import { useCallback, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { addressConfig } from "@/lib/config/addresses";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import {
  getAuthAddress,
  getOrcleAccountAddress,
  getPoolAddress,
  getPoolLpMintAddress,
  getPoolVaultAddress,
} from "@/lib/utils/instructions";

type CreatePoolParams = {
  ammConfig: PublicKey;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  token0Program?: PublicKey; // defaults to TOKEN_PROGRAM_ID
  token1Program?: PublicKey; // defaults to TOKEN_PROGRAM_ID
  initAmount0: BN; // in token decimals format
  initAmount1: BN; // in token decimals format
  openTime?: BN; // timestamp, defaults to current time
};

export function useCreatePool(
  program: Program<DoxxAmm> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error) => void,
) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | undefined>();

  const createPool = useCallback(
    async (params: CreatePoolParams) => {
      setIsCreating(true);
      setCreateError(undefined);

      if (!program || !wallet?.publicKey) {
        setIsCreating(false);
        setCreateError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider) {
        setIsCreating(false);
        setCreateError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      try {
        const {
          ammConfig,
          token0Mint,
          token1Mint,
          token0Program = TOKEN_PROGRAM_ID,
          token1Program = TOKEN_PROGRAM_ID,
          initAmount0,
          initAmount1,
          openTime = new BN(Math.floor(Date.now() / 1000)), // current timestamp
        } = params;

        // Ensure token0 < token1 (required by the program)
        const shouldSwap =
          token0Mint.toBuffer().compare(token1Mint.toBuffer()) >= 0;

        const [
          actualToken0Mint,
          actualToken1Mint,
          actualToken0Program,
          actualToken1Program,
          actualInitAmount0,
          actualInitAmount1,
        ] = shouldSwap
          ? [
              token1Mint,
              token0Mint,
              token1Program,
              token0Program,
              initAmount1,
              initAmount0,
            ]
          : [
              token0Mint,
              token1Mint,
              token0Program,
              token1Program,
              initAmount0,
              initAmount1,
            ];

        // Derive all required PDAs
        const [poolState] = getPoolAddress(
          ammConfig,
          actualToken0Mint,
          actualToken1Mint,
          program.programId,
        );

        const [authority] = getAuthAddress(program.programId);
        const [lpMint] = getPoolLpMintAddress(poolState, program.programId);
        const [token0Vault] = getPoolVaultAddress(
          poolState,
          actualToken0Mint,
          program.programId,
        );
        const [token1Vault] = getPoolVaultAddress(
          poolState,
          actualToken1Mint,
          program.programId,
        );
        const [observationState] = getOrcleAccountAddress(
          poolState,
          program.programId,
        );

        // Get user token accounts
        const creatorToken0 = getAssociatedTokenAddressSync(
          actualToken0Mint,
          wallet.publicKey,
          false,
          actualToken0Program,
        );

        const creatorToken1 = getAssociatedTokenAddressSync(
          actualToken1Mint,
          wallet.publicKey,
          false,
          actualToken1Program,
        );

        const creatorLpToken = getAssociatedTokenAddressSync(
          lpMint,
          wallet.publicKey,
          false,
          TOKEN_PROGRAM_ID,
        );

        // Create pool fee account address (network-specific)
        const createPoolFee = new PublicKey(
          addressConfig.contracts.createPoolFee,
        );

        // Create ATA instructions if needed
        const ataIxs = [
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            creatorToken0,
            wallet.publicKey,
            actualToken0Mint,
            actualToken0Program,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            creatorToken1,
            wallet.publicKey,
            actualToken1Mint,
            actualToken1Program,
          ),
        ];

        // Compute budget instructions
        const cuIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        ];

        // Create the initialize instruction
        const initializeIx = await program.methods
          .initialize(actualInitAmount0, actualInitAmount1, openTime)
          .accountsStrict({
            creator: wallet.publicKey,
            ammConfig,
            authority,
            poolState,
            token0Mint: actualToken0Mint,
            token1Mint: actualToken1Mint,
            lpMint,
            creatorToken0,
            creatorToken1,
            creatorLpToken,
            token0Vault,
            token1Vault,
            createPoolFee,
            observationState,
            tokenProgram: TOKEN_PROGRAM_ID,
            token0Program: actualToken0Program,
            token1Program: actualToken1Program,
            associatedTokenProgram: new PublicKey(
              "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
            ),
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction();

        const tx = new Transaction().add(...cuIxs, ...ataIxs, initializeIx);
        const sig = await provider.sendAndConfirm?.(tx, []);

        onSuccess(sig);
        setIsCreating(false);
        return {
          signature: sig,
          poolState,
          lpMint,
          token0Vault,
          token1Vault,
        };
      } catch (e) {
        console.log("🚀 ~ Pool creation error:", e);
        onError(e as Error);
        setCreateError(
          new Error(e instanceof Error ? e.message : "Unknown error"),
        );
        setIsCreating(false);
        return undefined;
      }
    },
    [program, wallet?.publicKey, onSuccess, onError],
  );

  return {
    createPool,
    isCreating,
    createError,
  };
}
