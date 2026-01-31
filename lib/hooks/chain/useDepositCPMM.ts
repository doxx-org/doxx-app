import { useCallback, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@/lib/constants";
import { DoxxCpmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import { getAuthAddress } from "@/lib/utils/instructions";

type DepositCPMMParams = {
  poolState: PublicKey;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  lpMint: PublicKey;
  token0Vault: PublicKey;
  token1Vault: PublicKey;
  token0Program?: PublicKey;
  token1Program?: PublicKey;
  lpTokenAmount: BN; // Amount of LP tokens to receive
  maximumToken0Amount: BN; // Maximum token0 to deposit (slippage protection)
  maximumToken1Amount: BN; // Maximum token1 to deposit (slippage protection)
};

export function useDepositCPMM(
  program: Program<DoxxCpmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error) => void,
) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<Error | undefined>();

  const deposit = useCallback(
    async (params: DepositCPMMParams) => {
      setIsDepositing(true);
      setDepositError(undefined);

      if (!program || !wallet?.publicKey) {
        setIsDepositing(false);
        setDepositError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider) {
        setIsDepositing(false);
        setDepositError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      try {
        const {
          poolState,
          token0Mint,
          token1Mint,
          lpMint,
          token0Vault,
          token1Vault,
          token0Program = TOKEN_PROGRAM_ID,
          token1Program = TOKEN_PROGRAM_ID,
          lpTokenAmount,
          maximumToken0Amount,
          maximumToken1Amount,
        } = params;

        const [authority] = getAuthAddress(program.programId);

        // Get user token accounts
        const ownerToken0 = getAssociatedTokenAddressSync(
          token0Mint,
          wallet.publicKey,
          false,
          token0Program,
        );

        const ownerToken1 = getAssociatedTokenAddressSync(
          token1Mint,
          wallet.publicKey,
          false,
          token1Program,
        );

        const ownerLpToken = getAssociatedTokenAddressSync(
          lpMint,
          wallet.publicKey,
          false,
          TOKEN_PROGRAM_ID,
        );

        // Create ATA instructions if needed
        const ataIxs = [
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            ownerToken0,
            wallet.publicKey,
            token0Mint,
            token0Program,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            ownerToken1,
            wallet.publicKey,
            token1Mint,
            token1Program,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            ownerLpToken,
            wallet.publicKey,
            lpMint,
            TOKEN_PROGRAM_ID,
          ),
        ];

        // Compute budget instructions
        const cuIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        ];

        // Create the deposit instruction
        const depositIx = await program.methods
          .deposit(lpTokenAmount, maximumToken0Amount, maximumToken1Amount)
          .accountsStrict({
            owner: wallet.publicKey,
            authority,
            poolState,
            ownerLpToken,
            token0Account: ownerToken0,
            token1Account: ownerToken1,
            token0Vault,
            token1Vault,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            vault0Mint: token0Mint,
            vault1Mint: token1Mint,
            lpMint,
          })
          .instruction();

        const tx = new Transaction().add(...cuIxs, ...ataIxs, depositIx);

        // Get recent blockhash for transaction
        const { blockhash, lastValidBlockHeight } =
          await provider.connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        // Sign and send transaction
        const signedTx = await wallet.signTransaction(tx);
        const sig = await provider.connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          },
        );

        console.log("Transaction sent:", sig);

        // Wait for confirmation
        const confirmation = await provider.connection.confirmTransaction(
          {
            signature: sig,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed",
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          );
        }

        console.log("Transaction confirmed:", sig);
        onSuccess(sig);
        setIsDepositing(false);
        return {
          signature: sig,
        };
      } catch (e) {
        console.log("🚀 ~ Deposit error:", e);
        onError(e as Error);
        setDepositError(
          new Error(e instanceof Error ? e.message : "Unknown error"),
        );
        setIsDepositing(false);
        return undefined;
      }
    },
    [program, onSuccess, onError, wallet],
  );

  return {
    deposit,
    isDepositing,
    depositError,
  };
}
