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
import { CLMMPoolState } from "@/lib/hooks/chain/types";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/constants";
import { getPoolAddress } from "@/lib/utils/instructions";

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
const DEFAULT_TICK_ARRAY_WINDOW = 5;

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

function i32ToLeBytes(num: number) {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, true);
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
    indices.push(startTickIndex + (zeroForOne ? -i * arraySpacing : i * arraySpacing));
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
    [CLMM_TICK_ARRAY_SEED, pool.toBuffer(), i32ToLeBytes(startTickIndex)],
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
  onError: (e: Error) => void,
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

        // Provide a small window of tick arrays around current tick.
        const tickCurrent = pool.tickCurrent;
        const tickSpacing = pool.tickSpacing;
        const start = getClmmTickArrayStartIndex({
          tickCurrent,
          tickSpacing,
        });
        const zeroForOne = inputIs0; // token0 -> token1 moves price down

        const startIndices = buildTickArrayStartIndices({
          startTickIndex: start,
          tickSpacing,
          zeroForOne,
          window: DEFAULT_TICK_ARRAY_WINDOW,
        });

        // Preserve order and only include existing tick arrays (to avoid InvalidTickArray errors)
        const tickArrayPks = startIndices.map((idx) => {
          const [addr] = getClmmTickArrayAddress({
            pool: poolAddress,
            startTickIndex: idx,
            programId: program.programId,
          });
          return addr;
        });
        const tickArrayInfos = await connection.getMultipleAccountsInfo(
          tickArrayPks,
        );
        const existingTickArrayMetas = tickArrayPks
          .map((pk, i) => ({ pk, i }))
          .filter(({ i }) => !!tickArrayInfos[i])
          .map(({ pk }) => ({ pubkey: pk, isWritable: true, isSigner: false }));

        // The current tick array must exist for swaps; fail early with a clear error
        if (!tickArrayInfos[0]) {
          throw new Error(
            `Missing current tick array account (startTickIndex=${start}). Pool may be uninitialized for swapping.`,
          );
        }

        const [tickArrayBitmapExt] = getClmmTickArrayBitmapExtensionAddress({
          pool: poolAddress,
          programId: program.programId,
        });

        const bitmapInfo = await connection.getAccountInfo(tickArrayBitmapExt);
        const remainingAccounts = [
          ...existingTickArrayMetas,
          ...(bitmapInfo
            ? [{ pubkey: tickArrayBitmapExt, isWritable: false, isSigner: false }]
            : []),
        ];

        const amount = kind === "in"
          ? (params as SwapBaseInputParams).amountIn
          : (params as SwapBaseOutputParams).amountOut;

        const otherAmountThreshold = kind === "in"
          ? (params as SwapBaseInputParams).minOut
          : (params as SwapBaseOutputParams).maxAmountIn;

        const ix = await program.methods
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
          .instruction();

        const tx = new Transaction().add(...cuIxs, ...ataIxs, ix);
        const sig = await provider.sendAndConfirm?.(tx, []);
        onSuccess(sig);
        setIsSwapping(false);
        return sig;
      } catch (e) {
        const err = e as Error;
        if (e instanceof SendTransactionError) {
          try {
            const logs = await e.getLogs(connection);
            console.error("CLMM swap simulation logs:\n" + logs.join("\n"));
          } catch {
            // ignore
          }
        }
        onError(err);
        setSwapError(new Error(err instanceof Error ? err.message : "Unknown error"));
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

