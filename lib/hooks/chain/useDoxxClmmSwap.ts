import { useCallback, useRef, useState } from "react";
import { BN, Program, utils as anchorUtils } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SendTransactionError,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/constants";
import { CLMMPoolState } from "@/lib/hooks/chain/types";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import { getPoolAddress } from "@/lib/utils/instructions";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const CLMM_TICK_ARRAY_SEED = Buffer.from(
  anchorUtils.bytes.utf8.encode("tick_array"),
);
const CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED = Buffer.from(
  anchorUtils.bytes.utf8.encode("pool_tick_array_bitmap_extension"),
);
const CLMM_TICK_ARRAY_SIZE = 60;
// How many tick arrays (including current) to pass into swaps.
// Too small => program can fail with NotEnoughTickArrayAccount (6027) on bigger swaps / thin liquidity.
// Too large => slightly larger tx (more account metas).
const DEFAULT_TICK_ARRAY_WINDOW = 12;
// Program requires at least this many tick array accounts; we can only pass ones that exist (or we get 3007).
const MIN_TICK_ARRAYS_FOR_SWAP = 2;

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

// NOTE: This CLMM program encodes numeric PDA seed args as big-endian bytes.
function i32ToBeBytes(num: number) {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return Buffer.from(arr);
}

function getClmmTickArrayStartIndex(params: {
  tickCurrent: number;
  tickSpacing: number;
}) {
  const { tickCurrent, tickSpacing } = params;
  const arraySpacing = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  if (arraySpacing === 0) return 0;
  return Math.floor(tickCurrent / arraySpacing) * arraySpacing;
}

function buildTickArrayStartIndices(params: {
  startTickIndex: number;
  tickSpacing: number;
  zeroForOne: boolean;
  window?: number;
}) {
  const { startTickIndex, tickSpacing, zeroForOne, window } = params;
  const w = Math.max(1, window ?? DEFAULT_TICK_ARRAY_WINDOW);
  const arraySpacing = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  if (arraySpacing === 0) return [startTickIndex];

  const indices: number[] = [];
  for (let i = 0; i < w; i++) {
    indices.push(
      startTickIndex + (zeroForOne ? -i * arraySpacing : i * arraySpacing),
    );
  }
  return indices;
}

function getClmmTickArrayAddress(params: {
  pool: PublicKey;
  startTickIndex: number;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, startTickIndex, programId } = params;
  return PublicKey.findProgramAddressSync(
    [CLMM_TICK_ARRAY_SEED, pool.toBuffer(), i32ToBeBytes(startTickIndex)],
    programId,
  );
}

function getClmmTickArrayBitmapExtensionAddress(params: {
  pool: PublicKey;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, programId } = params;
  return PublicKey.findProgramAddressSync(
    [CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED, pool.toBuffer()],
    programId,
  );
}

export function useDoxxClmmSwap(
  connection: Connection,
  program: Program<DoxxClmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error, txSignature?: string) => void,
) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<Error | undefined>();
  const mintProgramCache = useRef(new Map<string, PublicKey>());

  const resolveTokenProgramId = useCallback(
    async (mint: PublicKey): Promise<PublicKey> => {
      const key = mint.toBase58();
      const cached = mintProgramCache.current.get(key);
      if (cached) return cached;

      const info = await connection.getAccountInfo(mint);
      const owner = info?.owner;
      const programId =
        owner && owner.equals(TOKEN_2022_PROGRAM_ID)
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;
      mintProgramCache.current.set(key, programId);
      return programId;
    },
    [connection],
  );

  const buildAndSendSwap = useCallback(
    async ({
      pool,
      params,
      kind, // "in" | "out"
    }: {
      pool: CLMMPoolState;
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

        // CLMM pools store ordered mints (tokenMint0 < tokenMint1)
        if (
          !(
            (inputMint.equals(pool.tokenMint0) &&
              outputMint.equals(pool.tokenMint1)) ||
            (inputMint.equals(pool.tokenMint1) &&
              outputMint.equals(pool.tokenMint0))
          )
        ) {
          throw new Error(
            `Swap mints do not match pool. ` +
              `pool=[${pool.tokenMint0.toBase58()}, ${pool.tokenMint1.toBase58()}] ` +
              `swap=[${inputMint.toBase58()} -> ${outputMint.toBase58()}]`,
          );
        }

        const inputIs0 = inputMint.equals(pool.tokenMint0);
        const inputVault = inputIs0 ? pool.tokenVault0 : pool.tokenVault1;
        const outputVault = inputIs0 ? pool.tokenVault1 : pool.tokenVault0;

        const inputTokenProgram = await resolveTokenProgramId(inputMint);
        const outputTokenProgram = await resolveTokenProgramId(outputMint);

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
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
        ];

        const [poolAddress] = getPoolAddress(
          pool.ammConfig,
          pool.tokenMint0,
          pool.tokenMint1,
          program.programId,
        );
        console.log(
          "🚀 ~ pool.tickArrayBitmap.map(c=>c.toString()):",
          pool.tickArrayBitmap.map((c) => c.toString()),
        );
        // Provide a small window of tick arrays around current tick.
        const tickCurrent = pool.tickCurrent;
        console.log("🚀 ~ tickCurrent:", tickCurrent);
        const tickSpacing = pool.tickSpacing;
        console.log("🚀 ~ tickSpacing:", tickSpacing);
        const start = getClmmTickArrayStartIndex({
          tickCurrent,
          tickSpacing,
        });
        console.log("🚀 ~ start:", start);
        const zeroForOne = inputIs0; // token0 -> token1 moves price down

        const startIndices = buildTickArrayStartIndices({
          startTickIndex: start,
          tickSpacing,
          zeroForOne,
          window: DEFAULT_TICK_ARRAY_WINDOW,
        });

        // Preserve order of tick arrays around the current tick.
        const tickArrayPks = startIndices.map((idx) => {
          const [addr] = getClmmTickArrayAddress({
            pool: poolAddress,
            startTickIndex: idx,
            programId: program.programId,
          });
          return addr;
        });
        console.log("🚀 ~ startIndices:", startIndices);
        const tickArrayInfos =
          await connection.getMultipleAccountsInfo(tickArrayPks);
        console.log("🚀 ~ tickArrayInfos:", tickArrayInfos);
        // The current tick array must exist for swaps; fail early with a clear error
        if (!tickArrayInfos[0]) {
          throw new Error(
            `Missing current tick array account (startTickIndex=${start}). ` +
              `This pool has no tick-array initialized at the current price, so swapping will fail. ` +
              `Try a different pool, or initialize liquidity/positions spanning the current price.`,
          );
        }
        // Only pass tick arrays that exist on-chain. Passing PDAs for uninitialized tick arrays
        // causes AccountOwnedByWrongProgram (3007) because the account is system-owned.
        const tickArrayMetas = tickArrayPks
          .map((pk, i) =>
            tickArrayInfos[i]
              ? {
                  pubkey: pk,
                  isWritable: true as const,
                  isSigner: false as const,
                }
              : null,
          )
          .filter(
            (
              m,
            ): m is { pubkey: PublicKey; isWritable: true; isSigner: false } =>
              m != null,
          );
        console.log("🚀 ~ tickArrayMetas:", tickArrayMetas);

        if (tickArrayMetas.length < MIN_TICK_ARRAYS_FOR_SWAP) {
          throw new Error(
            `Not enough initialized tick arrays for swap (${tickArrayMetas.length}, need at least ${MIN_TICK_ARRAYS_FOR_SWAP}). ` +
              `Add liquidity (deposit) into this pool in a range that spans the current price so more tick arrays are initialized, or use a different pool.`,
          );
        }

        const [tickArrayBitmapExt] = getClmmTickArrayBitmapExtensionAddress({
          pool: poolAddress,
          programId: program.programId,
        });
        // Program requires tick array bitmap extension (6040 MissingTickArrayBitmapExtensionAccount).
        // Always pass it; the program may create it if not yet initialized.
        const tickArrayBitmapExtMeta = {
          pubkey: tickArrayBitmapExt,
          isWritable: false,
          isSigner: false,
        };
        const remainingAccounts = [...tickArrayMetas, tickArrayBitmapExtMeta];

        const amount =
          kind === "in"
            ? (params as SwapBaseInputParams).amountIn
            : (params as SwapBaseOutputParams).amountOut;

        const otherAmountThreshold =
          kind === "in"
            ? (params as SwapBaseInputParams).minOut
            : (params as SwapBaseOutputParams).maxAmountIn;

        // Some chains/RPCs don't have the Memo program deployed as executable.
        // `swap_v2` requires `memo_program` and will fail with Anchor's InvalidProgramExecutable (3009).
        // In that case, fall back to the legacy `swap` instruction (deprecated upstream, but works without memo).
        const memoInfo = await connection.getAccountInfo(MEMO_PROGRAM_ID);
        const memoExecutable = memoInfo?.executable === true;

        const ix = memoExecutable
          ? await program.methods
              .swapV2(
                amount,
                otherAmountThreshold,
                new BN(0), // sqrtPriceLimitX64 = 0 (no limit)
                kind === "in",
              )
              .accounts({
                payer: wallet.publicKey,
                ammConfig: pool.ammConfig,
                poolState: poolAddress,
                inputTokenAccount,
                outputTokenAccount,
                inputVault,
                outputVault,
                observationState: pool.observationKey,
                inputVaultMint: inputMint,
                outputVaultMint: outputMint,
              })
              .remainingAccounts(remainingAccounts)
              .instruction()
          : await program.methods
              .swap(
                amount,
                otherAmountThreshold,
                new BN(0), // sqrtPriceLimitX64 = 0 (no limit)
                kind === "in",
              )
              .accounts({
                payer: wallet.publicKey,
                ammConfig: pool.ammConfig,
                poolState: poolAddress,
                inputTokenAccount,
                outputTokenAccount,
                inputVault,
                outputVault,
                observationState: pool.observationKey,
                tickArray: tickArrayMetas[0]!.pubkey,
              })
              .remainingAccounts([
                ...tickArrayMetas.slice(1),
                tickArrayBitmapExtMeta,
              ])
              .instruction();

        const tx = new Transaction().add(...cuIxs, ...ataIxs, ix);
        tx.feePayer = wallet.publicKey;

        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        const signed = await wallet.signTransaction(tx);
        const raw = signed.serialize();
        const sig = await connection.sendRawTransaction(raw, {
          // We only support Solayer for now.
          skipPreflight: true,
          preflightCommitment: "confirmed",
          maxRetries: 5,
        });

        // Poll signature status
        const status = await pollSignatureStatus({
          connection,
          signature: sig,
          timeoutMs: 120_000,
        });
        if (!status) {
          onError(new Error("TransactionNotFoundOnChain"), sig);
          return undefined;
        }

        onSuccess(sig);
        setIsSwapping(false);
        return sig;
      } catch (e) {
        console.log("🚀 ~ e:", e);
        const err = e as Error;
        let message = err instanceof Error ? err.message : "Unknown error";
        if (e instanceof SendTransactionError) {
          try {
            const logs = await e.getLogs(connection);
            console.error("CLMM swap simulation logs:\n" + logs.join("\n"));
            const logStr = logs.join(" ");
            if (
              logStr.includes("6027") ||
              logStr.includes("NotEnoughTickArrayAccount")
            ) {
              message =
                "Not enough tick arrays for swap (6027). Add liquidity (deposit) into this pool in a range that spans the current price to initialize more tick arrays, or use a different pool.";
            }
          } catch {
            // ignore
          }
        } else if (
          message.includes("6027") ||
          message.includes("NotEnoughTickArrayAccount")
        ) {
          message =
            "Not enough tick arrays for swap (6027). Add liquidity (deposit) into this pool in a range that spans the current price to initialize more tick arrays, or use a different pool.";
        }
        const userErr = new Error(message);
        onError(userErr);
        setSwapError(userErr);
        setIsSwapping(false);
        return undefined;
      }
    },
    [connection, program, wallet, onSuccess, onError, resolveTokenProgramId],
  );

  const swapBaseInput = useCallback(
    (pool: CLMMPoolState, params: SwapBaseInputParams) =>
      buildAndSendSwap({ pool, params, kind: "in" }),
    [buildAndSendSwap],
  );

  const swapBaseOutput = useCallback(
    (pool: CLMMPoolState, params: SwapBaseOutputParams) =>
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
