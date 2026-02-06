import { useCallback, useRef, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { CLMM_MAX_TICK, CLMM_MIN_TICK, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, TWO_POW_128 } from "@/lib/constants";
import { CHAIN, clientEnvConfig } from "@/lib/config/envConfig";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  applyBuffer,
  bnToBigint,
  clampTick,
  computeSqrtPriceX64,
  estimateLegacyTxSize,
  mulDiv,
  priceX128FromSqrtPriceX64,
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
  tickArrayStartIndex,
  tickFromPriceAperB,
} from "@/lib/utils";
import {
  getClmmTickArrayAddress,
  getClmmTickArrayBitmapExtensionAddress,
  getOrcleAccountAddress,
  getPersonalPositionAddress,
  getPoolAddress,
  getPoolVaultAddress,
  getProtocolPositionAddress,
} from "@/lib/utils/instructions";
import { parseAmountBN } from "@/lib/utils";
import { toast } from "sonner";
import { PriceMode } from "@/components/earn/v2/types";

const CLMM_TICK_ARRAY_SIZE = 60;
const LEGACY_TX_MAX_BYTES = 1232; // common wallet-adapter legacy tx cap

type CreateClmmPoolAndPositionParams = {
  ammConfig: PublicKey;
  tickSpacing: number;

  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;

  /** UI price: tokenA per tokenB (A/B). Used to initialize pool sqrtPrice. */
  initialPriceAperB: string;

  /** Amounts user wants to deposit into the initial position (UI token units). */
  amountA: string;
  amountB: string;

  /** Price range (UI token units, tokenA per tokenB). */
  priceMode: PriceMode;
  minPriceAperB?: string;
  maxPriceAperB?: string;

  /** Extra buffer for amount_0_max / amount_1_max slippage checks (e.g. 0.02 = +2%). */
  maxAmountBufferPct?: number;
};






// IMPORTANT: use on-chain time, not local time (local clock skew can break create_pool)
// create_pool requires open_time < current chain block_timestamp.
async function getSafeOpenTime(connection: Connection) {
  try {
    const slot = await connection.getSlot("processed");
    const blockTime = await connection.getBlockTime(slot);
    if (typeof blockTime === "number" && Number.isFinite(blockTime)) {
      return new BN(Math.max(0, Math.floor(blockTime) - 10));
    }
  } catch {
    // ignore
  }
  return new BN(0);
}

async function pollSignatureStatus(params: {
  connection: Connection;
  signature: string;
  timeoutMs: number;
}) {
  const { connection, signature, timeoutMs } = params;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const s0 = st.value[0];
    if (s0) {
      if (s0.err) {
        throw new Error(
          `TransactionFailed:${signature}:${JSON.stringify(s0.err)}`,
        );
      }
      if (s0.confirmationStatus) return s0.confirmationStatus;
    }

    // Some RPCs don't reliably populate signature statuses. Fall back to getTransaction.
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx?.meta) {
        if (tx.meta.err) {
          throw new Error(
            `TransactionFailed:${signature}:${JSON.stringify(tx.meta.err)}`,
          );
        }
        return "confirmed";
      }
    } catch {
      // ignore and continue polling
    }

    await new Promise((r) => setTimeout(r, 800));
  }
  return undefined;
}

function getFallbackRpcForNetwork(): string | undefined {
  // Only fall back to Solana public RPC if we are actually on Solana.
  // If we're on Solayer, using Solana RPC guarantees failures (different cluster).
  if (clientEnvConfig.NEXT_PUBLIC_CHAIN !== CHAIN.SOLANA) return undefined;
  const net = clientEnvConfig.NEXT_PUBLIC_NETWORK;
  if (net === "devnet") return "https://api.devnet.solana.com";
  return "https://api.mainnet-beta.solana.com";
}

async function broadcastRawTxToFallback(params: {
  rawTx: Uint8Array;
  signature: string;
}) {
  const { rawTx, signature } = params;
  const fallbackEndpoint = getFallbackRpcForNetwork();
  if (!fallbackEndpoint) return;
  try {
    const fallback = new Connection(fallbackEndpoint, "confirmed");
    // Best-effort: if primary RPC doesn't propagate, this helps explorers see the tx.
    await fallback.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 2,
    });
    console.log("Broadcasted tx to fallback RPC:", fallbackEndpoint, signature);
  } catch (e) {
    console.warn("Failed to broadcast tx to fallback RPC:", fallbackEndpoint, e);
  }
}

// function estimateLegacyTxSize(params: {
//   feePayer: PublicKey;
//   recentBlockhash: string;
//   instructions: TransactionInstruction[];
//   signers?: Keypair[];
// }) {
//   const { feePayer, recentBlockhash, instructions, signers = [] } = params;
//   try {
//     const tx = new Transaction().add(...instructions);
//     tx.feePayer = feePayer;
//     tx.recentBlockhash = recentBlockhash;
//     if (signers.length > 0) tx.partialSign(...signers);
//     // Signature bytes are a fixed-width part of the serialized tx; content doesn't change size.
//     return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
//   } catch {
//     // `Transaction.serialize` throws when the legacy tx is too large.
//     // For sizing/planning purposes, treat this as "definitely too large".
//     return Number.POSITIVE_INFINITY;
//   }
// }



export function useCreateClmmPoolAndPosition(
  connection: Connection,
  program: Program<DoxxClmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error, txSignature?: string) => void,
) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | undefined>();
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

  const createPoolAndPosition = useCallback(
    async (params: CreateClmmPoolAndPositionParams) => {
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
        console.log("🚀 ~ params:", params)
        const {
          ammConfig,
          tickSpacing,
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          initialPriceAperB,
          amountA,
          amountB,
          priceMode,
          minPriceAperB,
          maxPriceAperB,
          maxAmountBufferPct = 0.02,
        } = params;

        if (!amountA && !amountB) {
          throw new Error("Enter token amounts to supply liquidity");
        }

        // Ensure tokenMint0 < tokenMint1 (required by CLMM program)
        const shouldSwap = Buffer.compare(tokenAMint.toBuffer(), tokenBMint.toBuffer()) >= 0;
        const tokenMint0 = shouldSwap ? tokenBMint : tokenAMint;
        const tokenMint1 = shouldSwap ? tokenAMint : tokenBMint;

        const tokenProgram0 = await resolveTokenProgramId(tokenMint0);
        const tokenProgram1 = await resolveTokenProgramId(tokenMint1);

        const sqrtPriceX64 = computeSqrtPriceX64({
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          tokenMint0,
          tokenMint1,
          priceAperB: initialPriceAperB,
        });

        // Derive pool PDAs
        const [poolState] = getPoolAddress(
          ammConfig,
          tokenMint0,
          tokenMint1,
          program.programId,
        );
        const [tokenVault0] = getPoolVaultAddress(
          poolState,
          tokenMint0,
          program.programId,
        );
        const [tokenVault1] = getPoolVaultAddress(
          poolState,
          tokenMint1,
          program.programId,
        );
        const [observationState] = getOrcleAccountAddress(
          poolState,
          program.programId,
        );
        const [tickArrayBitmap] = getClmmTickArrayBitmapExtensionAddress({
          pool: poolState,
          programId: program.programId,
        });

        // User token accounts for deposits (support token2022)
        const ownerToken0 = getAssociatedTokenAddressSync(
          tokenMint0,
          wallet.publicKey,
          false,
          tokenProgram0,
        );
        const ownerToken1 = getAssociatedTokenAddressSync(
          tokenMint1,
          wallet.publicKey,
          false,
          tokenProgram1,
        );

        const ataIxs = [
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            ownerToken0,
            wallet.publicKey,
            tokenMint0,
            tokenProgram0,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            ownerToken1,
            wallet.publicKey,
            tokenMint1,
            tokenProgram1,
          ),
        ];

        let tickLowerIndex: number;
        let tickUpperIndex: number;
        console.log("🚀 ~ priceMode:", priceMode)
        if (priceMode === PriceMode.FULL) {
          tickLowerIndex = Math.ceil(CLMM_MIN_TICK / tickSpacing) * tickSpacing;
          tickUpperIndex = Math.floor(CLMM_MAX_TICK / tickSpacing) * tickSpacing;
        } else {
          const minP = Number(minPriceAperB || "");
          console.log("🚀 ~ minP:", minP)
          const maxP = Number(maxPriceAperB || "");
          console.log("🚀 ~ maxP:", maxP)
          if (!Number.isFinite(minP) || !Number.isFinite(maxP) || minP <= 0 || maxP <= 0) {
            throw new Error("Enter valid min/max prices");
          }
          const lo = Math.min(minP, maxP);
          const hi = Math.max(minP, maxP);
          const rawLower = tickFromPriceAperB({
            priceAperB: lo,
            tokenAMint,
            tokenBMint,
            tokenADecimals,
            tokenBDecimals,
            tokenMint0,
            tokenMint1,
          });
          const rawUpper = tickFromPriceAperB({
            priceAperB: hi,
            tokenAMint,
            tokenBMint,
            tokenADecimals,
            tokenBDecimals,
            tokenMint0,
            tokenMint1,
          });
          tickLowerIndex = Math.floor(rawLower / tickSpacing) * tickSpacing;
          tickUpperIndex = Math.ceil(rawUpper / tickSpacing) * tickSpacing;
        }

        tickLowerIndex = clampTick(tickLowerIndex, tickSpacing);
        tickUpperIndex = clampTick(tickUpperIndex, tickSpacing);
        if (tickUpperIndex <= tickLowerIndex) {
          tickUpperIndex = tickLowerIndex + tickSpacing;
        }

        // For "Full range" positions, the program will only initialize the lower/upper tick arrays.
        // That often leaves the *current* tick array (used by swap) uninitialized, making the pool "not swappable".
        // We bootstrap by opening a tiny additional position that initializes the current tick array PDA.
        const currentTickIndexRaw = tickFromPriceAperB({
          priceAperB: Number(initialPriceAperB),
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          tokenMint0,
          tokenMint1,
        });
        const currentTickIndex = clampTick(
          Math.floor(currentTickIndexRaw / tickSpacing) * tickSpacing,
          tickSpacing,
        );

        const tickArrayLowerStartIndex = tickArrayStartIndex(
          tickLowerIndex,
          tickSpacing,
        );
        const tickArrayUpperStartIndex = tickArrayStartIndex(
          tickUpperIndex,
          tickSpacing,
        );

        const [tickArrayLower] = getClmmTickArrayAddress({
          pool: poolState,
          startTickIndex: tickArrayLowerStartIndex,
          programId: program.programId,
        });
        const [tickArrayUpper] = getClmmTickArrayAddress({
          pool: poolState,
          startTickIndex: tickArrayUpperStartIndex,
          programId: program.programId,
        });

        const [protocolPosition] = getProtocolPositionAddress({
          pool: poolState,
          tickLowerIndex,
          tickUpperIndex,
          programId: program.programId,
        });

        // Open position can exceed default 200k CU; use Solana max 1.4M.
        const cuIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
        ];

        const safeOpenTime = await getSafeOpenTime(connection);

        console.log("🚀 ~ tickArrayLowerStartIndex:", tickArrayLowerStartIndex)
        console.log("🚀 ~ tickArrayUpperStartIndex:", tickArrayUpperStartIndex)
        console.log("🚀 ~ tickArrayLower:", tickArrayLower.toString())
        console.log("🚀 ~ tickArrayUpper:", tickArrayUpper.toString())

        const createPoolIx = await program.methods
          .createPool(sqrtPriceX64, safeOpenTime)
          .accounts({
            poolCreator: wallet.publicKey,
            ammConfig,
            poolState,
            tokenMint0,
            tokenMint1,
            tokenVault0,
            tokenVault1,
            observationState,
            tickArrayBitmap,
            tokenProgram0,
            tokenProgram1,
          })
          .instruction();

        const withMetadata = false;
        const amountAMax = parseAmountBN(amountA, tokenADecimals);
        const amountBMax = parseAmountBN(amountB, tokenBDecimals);
        // Apply a small buffer so the program's internal price/liquidity rounding doesn't trip slippage checks.
        const a0MaxBase = applyBuffer(
          shouldSwap ? amountBMax : amountAMax,
          maxAmountBufferPct,
        );
        const a1MaxBase = applyBuffer(
          shouldSwap ? amountAMax : amountBMax,
          maxAmountBufferPct,
        );

        const amount0MaxAllowed = a0MaxBase;
        console.log("🚀 ~ amount0MaxAllowed:", amount0MaxAllowed.toString())
        const amount1MaxAllowed = a1MaxBase;
        console.log("🚀 ~ amount1MaxAllowed:", amount1MaxAllowed.toString())
        const liquidity = new BN(0);

        // Pre-compute implied token1/token0 price from sqrtPriceX64 for slippage bounds.
        // This helps avoid 6021 PriceSlippageCheck when liquidity=0 and base_flag is used.
        const priceNumX128 = priceX128FromSqrtPriceX64(sqrtPriceX64); // numerator, denom=2^128
        const bufferPpm = Math.floor((1 + (maxAmountBufferPct ?? 0)) * 1_000_000);

        const baseFlag = (() => {
          const a0 = bnToBigint(amount0MaxAllowed);
          const a1 = bnToBigint(amount1MaxAllowed);
          if (a0 === 0n && a1 > 0n) return false;
          if (a1 === 0n && a0 > 0n) return true;

          const req1From0 = mulDiv(a0, priceNumX128, TWO_POW_128);
          const req0From1 = mulDiv(a1, TWO_POW_128, priceNumX128);

          const okBase0 = req1From0 <= a1;
          const okBase1 = req0From1 <= a0;

          if (okBase0 && !okBase1) return true;
          if (okBase1 && !okBase0) return false;
          if (okBase0 && okBase1) {
            // Prefer the option that uses a higher % of the "base" amount (less leftover on that side).
            // Compare leftover ratios in ppm.
            const left1Ppm =
              a1 === 0n ? 0n : ((a1 - req1From0) * 1_000_000n) / a1;
            const left0Ppm =
              a0 === 0n ? 0n : ((a0 - req0From1) * 1_000_000n) / a0;
            return left1Ppm <= left0Ppm;
          }

          // Neither base choice can satisfy the ratio under the provided max amounts (+buffer).
          // In a UI you'd ask user to increase one side or use a narrower price range.
          throw new Error(
            `Cannot satisfy PriceSlippageCheck (6021) with provided max amounts (buffer=${(bufferPpm - 1_000_000) / 10_000}% approx). ` +
            `Try increasing the smaller side amount, increasing buffer, or using priceMode=Custom.`,
          );
        })();

        const shouldBootstrapTickArrays = priceMode === "Full";
        const bootstrapAmount0MaxAllowed = (() => {
          const tiny = amount0MaxAllowed.div(new BN(10_000)); // 0.01% of user's max (best-effort)
          if (!tiny.isZero()) return tiny;
          if (amount0MaxAllowed.isZero()) return new BN(0);
          return new BN(1);
        })();
        const bootstrapAmount1MaxAllowed = (() => {
          const tiny = amount1MaxAllowed.div(new BN(10_000)); // 0.01% of user's max (best-effort)
          if (!tiny.isZero()) return tiny;
          if (amount1MaxAllowed.isZero()) return new BN(0);
          return new BN(1);
        })();

        // Bootstrap range:
        // - lower is forced into the *previous* tick-array, so tick_array_lower != tick_array_upper
        // - upper is in the *current* tick-array, so the current tick array PDA gets initialized
        const tickArraySpan = tickSpacing * CLMM_TICK_ARRAY_SIZE;
        const currentTickArrayStart = tickArrayStartIndex(currentTickIndex, tickSpacing);
        const maxTickInCurrentArray = currentTickArrayStart + tickArraySpan - tickSpacing;
        const candidateUpper = clampTick(currentTickIndex + tickSpacing, tickSpacing);

        // Normal case: upper stays inside current tick-array -> initialize previous + current tick arrays.
        // Edge case (current tick at end of array): candidateUpper moves into next tick-array -> initialize current + next.
        const bootstrapTickLowerIndex = clampTick(
          candidateUpper <= maxTickInCurrentArray
            ? currentTickIndex - tickArraySpan
            : currentTickIndex - tickSpacing,
          tickSpacing,
        );
        const bootstrapTickUpperIndex = candidateUpper;
        if (shouldBootstrapTickArrays && bootstrapTickUpperIndex <= bootstrapTickLowerIndex) {
          throw new Error("Unable to derive bootstrap tick range for full-range pool initialization");
        }

        const bootstrapTickArrayLowerStartIndex = tickArrayStartIndex(
          bootstrapTickLowerIndex,
          tickSpacing,
        );
        const bootstrapTickArrayUpperStartIndex = tickArrayStartIndex(
          bootstrapTickUpperIndex,
          tickSpacing,
        );
        const [bootstrapTickArrayLower] = getClmmTickArrayAddress({
          pool: poolState,
          startTickIndex: bootstrapTickArrayLowerStartIndex,
          programId: program.programId,
        });
        const [bootstrapTickArrayUpper] = getClmmTickArrayAddress({
          pool: poolState,
          startTickIndex: bootstrapTickArrayUpperStartIndex,
          programId: program.programId,
        });
        const [bootstrapProtocolPosition] = getProtocolPositionAddress({
          pool: poolState,
          tickLowerIndex: bootstrapTickLowerIndex,
          tickUpperIndex: bootstrapTickUpperIndex,
          programId: program.programId,
        });

        const bootstrapPositionNftMint = shouldBootstrapTickArrays
          ? Keypair.generate()
          : undefined;
        const bootstrapPositionNftAccount = bootstrapPositionNftMint
          ? getAssociatedTokenAddressSync(
            bootstrapPositionNftMint.publicKey,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
          )
          : undefined;
        const bootstrapPersonalPosition = bootstrapPositionNftMint
          ? getPersonalPositionAddress(program.programId, bootstrapPositionNftMint.publicKey)
          : undefined;

        const positionNftMint = Keypair.generate();
        const positionNftOwner = wallet.publicKey;
        const positionNftAccount = getAssociatedTokenAddressSync(
          positionNftMint.publicKey,
          positionNftOwner,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        const personalPosition = getPersonalPositionAddress(program.programId, positionNftMint.publicKey);

        console.log("🚀 ~ tickLowerIndex:", tickLowerIndex)
        console.log("🚀 ~ tickUpperIndex:", tickUpperIndex)
        console.log("🚀 ~ tickArrayLowerStartIndex:", tickArrayLowerStartIndex)
        console.log("🚀 ~ tickArrayUpperStartIndex:", tickArrayUpperStartIndex)
        console.log("🚀 ~ liquidity:", liquidity.toString())
        console.log("🚀 ~ amount0MaxAllowed:", amount0MaxAllowed.toString())
        console.log("🚀 ~ amount1MaxAllowed:", amount1MaxAllowed.toString())
        console.log("🚀 ~ withMetadata:", withMetadata)
        console.log("🚀 ~ baseFlag:", baseFlag)
        let openPosIx = await program.methods
          .openPositionWithToken22Nft(
            tickLowerIndex,
            tickUpperIndex,
            tickArrayLowerStartIndex,
            tickArrayUpperStartIndex,
            liquidity,
            amount0MaxAllowed,
            amount1MaxAllowed,
            withMetadata,
            baseFlag,
          )
          .accounts({
            payer: wallet.publicKey,
            positionNftOwner: positionNftOwner,
            positionNftMint: positionNftMint.publicKey,
            positionNftAccount: positionNftAccount,
            poolState,
            protocolPosition,
            tickArrayLower,
            tickArrayUpper,
            personalPosition,
            tokenAccount0: ownerToken0,
            tokenAccount1: ownerToken1,
            tokenVault0: tokenVault0,
            tokenVault1: tokenVault1,
            vault0Mint: tokenMint0,
            vault1Mint: tokenMint1,
          })
          .instruction();

        const bootstrapOpenPosIx = shouldBootstrapTickArrays
          ? await program.methods
            .openPositionWithToken22Nft(
              bootstrapTickLowerIndex,
              bootstrapTickUpperIndex,
              bootstrapTickArrayLowerStartIndex,
              bootstrapTickArrayUpperStartIndex,
              liquidity,
              bootstrapAmount0MaxAllowed,
              bootstrapAmount1MaxAllowed,
              withMetadata,
              baseFlag,
            )
            .accounts({
              payer: wallet.publicKey,
              positionNftOwner: positionNftOwner,
              positionNftMint: bootstrapPositionNftMint!.publicKey,
              positionNftAccount: bootstrapPositionNftAccount!,
              poolState,
              protocolPosition: bootstrapProtocolPosition,
              tickArrayLower: bootstrapTickArrayLower,
              tickArrayUpper: bootstrapTickArrayUpper,
              personalPosition: bootstrapPersonalPosition!,
              tokenAccount0: ownerToken0,
              tokenAccount1: ownerToken1,
              tokenVault0: tokenVault0,
              tokenVault1: tokenVault1,
              vault0Mint: tokenMint0,
              vault1Mint: tokenMint1,
            })
            .instruction()
          : undefined;

        const isSolayer = clientEnvConfig.NEXT_PUBLIC_CHAIN === CHAIN.SOLAYER;

        // Split into multiple transactions when needed to fit wallet tx-size limits.
        const sendAndPoll = async (args: {
          instructions: TransactionInstruction[];
          signers?: Keypair[];
          label: string;
        }) => {
          const { instructions, signers = [], label } = args;
          const tx = new Transaction().add(...instructions);
          tx.feePayer = wallet.publicKey;
          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash;
          if (signers.length > 0) tx.partialSign(...signers);
          const signed = await wallet.signTransaction(tx);
          const raw = signed.serialize();
          const sig = await connection.sendRawTransaction(raw, {
            // Solayer RPCs can be flaky with simulate/preflight; skip it there.
            skipPreflight: isSolayer,
            preflightCommitment: "confirmed",
            maxRetries: 5,
          });

          try {
            const status = await pollSignatureStatus({
              connection,
              signature: sig,
              timeoutMs: 120_000,
            });
            if (!status) {
              onError(new Error(`TransactionNotFoundOnChain:${label}`), sig);
              return undefined;
            }
          } catch (e) {
            // Try to fetch logs for a better error message.
            try {
              const txInfo = await connection.getTransaction(sig, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
              });
              const logs = txInfo?.meta?.logMessages ?? [];
              const err = txInfo?.meta?.err;
              const tail = logs.slice(-60).join("\n");
              const wrapped = new Error(
                `TxFailed:${label}:${sig}:${JSON.stringify(err ?? String(e))}\n` +
                (tail ? `--- logs (tail) ---\n${tail}` : ""),
              );
              onError(wrapped, sig);
              throw wrapped;
            } catch {
              const wrapped = new Error(
                `TxFailed:${label}:${sig}:${e instanceof Error ? e.message : String(e)}`,
              );
              onError(wrapped, sig);
              throw wrapped;
            }
          }
          return sig;
        };


        // Pre-plan tx splits based on estimated legacy serialized size.
        const { blockhash: sizingBlockhash } = await connection.getLatestBlockhash("confirmed");

        const pickCu = (base: TransactionInstruction[], signers?: Keypair[]) => {
          const withCu = [...cuIxs, ...base];
          const sizeWithCu = estimateLegacyTxSize({
            feePayer: wallet.publicKey,
            recentBlockhash: sizingBlockhash,
            instructions: withCu,
            signers,
          });
          if (sizeWithCu <= LEGACY_TX_MAX_BYTES) return withCu;

          const sizeNoCu = estimateLegacyTxSize({
            feePayer: wallet.publicKey,
            recentBlockhash: sizingBlockhash,
            instructions: base,
            signers,
          });
          if (sizeNoCu <= LEGACY_TX_MAX_BYTES) return base;

          return undefined;
        };

        // Position instructions need high compute; never send without Compute Budget or we get ProgramFailedToComplete.
        const pickCuRequired = (base: TransactionInstruction[], signers?: Keypair[]) => {
          const withCu = [...cuIxs, ...base];
          const sizeWithCu = estimateLegacyTxSize({
            feePayer: wallet.publicKey,
            recentBlockhash: sizingBlockhash,
            instructions: withCu,
            signers,
          });
          if (sizeWithCu <= LEGACY_TX_MAX_BYTES) return withCu;
          return undefined;
        };

        const tx1Instructions = pickCu([...ataIxs, createPoolIx]);
        if (!tx1Instructions) {
          throw new Error(
            `TxTooLarge:create_pool even without CU ixs (max=${LEGACY_TX_MAX_BYTES} bytes).`,
          );
        }

        const txPlan: Array<{
          label: string;
          instructions: TransactionInstruction[];
          signers?: Keypair[];
        }> = [];

        if (bootstrapOpenPosIx && bootstrapPositionNftMint) {
          // Try bundling bootstrap + full-range in a single tx, otherwise split.
          const combined = pickCuRequired(
            [bootstrapOpenPosIx, openPosIx],
            [bootstrapPositionNftMint, positionNftMint],
          );

          if (combined) {
            txPlan.push({
              label: "bootstrap+open_position_full_range",
              instructions: combined,
              signers: [bootstrapPositionNftMint, positionNftMint],
            });
          } else {
            const bootstrapOnly = pickCuRequired(
              [bootstrapOpenPosIx],
              [bootstrapPositionNftMint],
            );
            const fullOnly = pickCuRequired([openPosIx], [positionNftMint]);

            if (!bootstrapOnly || !fullOnly) {
              throw new Error(
                `TxTooLarge:open_position even when split (max=${LEGACY_TX_MAX_BYTES} bytes). ` +
                `Next step is v0 + ALT.`,
              );
            }

            txPlan.push({
              label: "bootstrap_open_position",
              instructions: bootstrapOnly,
              signers: [bootstrapPositionNftMint],
            });
            txPlan.push({
              label: "open_position_full_range",
              instructions: fullOnly,
              signers: [positionNftMint],
            });
          }
        } else {
          const fullOnly = pickCuRequired([openPosIx], [positionNftMint]);
          if (!fullOnly) {
            throw new Error(
              `TxTooLarge:open_position_full_range (max=${LEGACY_TX_MAX_BYTES} bytes). Next step is v0 + ALT.`,
            );
          }
          txPlan.push({
            label: "open_position_full_range",
            instructions: fullOnly,
            signers: [positionNftMint],
          });
        }

        // Important UX invariant:
        // Do NOT broadcast `create_pool` unless we were able to fully plan the follow-up
        // position txs within legacy limits. Otherwise we can create a pool without a position.
        const sig1 = await sendAndPoll({
          label: "create_pool",
          instructions: tx1Instructions,
        });
        if (!sig1) return undefined;

        let lastSig: string | undefined;
        for (const step of txPlan) {
          lastSig = await sendAndPoll(step);
          if (!lastSig) return undefined;
        }

        onSuccess(lastSig);
        setIsCreating(false);
        return lastSig;
      } catch (e) {
        console.log("🚀 ~ CLMM create+position error:", e);
        const err = e as Error;
        try {
          const anyErr = e as any;
          const logsFromField: string[] | undefined = Array.isArray(anyErr?.logs)
            ? anyErr.logs
            : undefined;

          let logs: string[] | undefined = logsFromField;

          // In some bundler setups `instanceof SendTransactionError` can fail,
          // so prefer feature-detecting `getLogs`.
          if (!logs && typeof anyErr?.getLogs === "function") {
            try {
              logs = await anyErr.getLogs(connection);
            } catch (logErr) {
              console.error(
                "Failed to fetch simulation logs via getLogs():",
                logErr,
              );
            }
          }

          if (logs && logs.length > 0) {
            console.error(
              "CLMM create+position simulation logs:\n" + logs.join("\n"),
            );
          } else {
            console.error(
              "No simulation logs found on error object. (If this persists, simulate the tx explicitly.)",
            );
          }
        } catch (logHandlingErr) {
          console.error("Failed while handling simulation logs:", logHandlingErr);
        }
        onError(err);
        setCreateError(new Error(err instanceof Error ? err.message : "Unknown error"));
        setIsCreating(false);
        return undefined;
      }
    },
    [program, wallet?.publicKey, onSuccess, onError, resolveTokenProgramId],
  );

  return { createPoolAndPosition, isCreating, createError };
}

