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
import { PriceMode } from "@/components/earn/v2/types";
import { CHAIN, clientEnvConfig } from "@/lib/config/envConfig";
import {
  CLMM_MAX_TICK,
  CLMM_MIN_TICK,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TWO_POW_128,
} from "@/lib/constants";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
  applyBuffer,
  bnToBigint,
  clampTick,
  computeSqrtPriceX64,
  estimateLegacyTxSize,
  mulDiv,
  priceX128FromSqrtPriceX64,
  tickArrayStartIndex,
  tickFromPriceAperB,
} from "@/lib/utils";
import { parseAmountBN } from "@/lib/utils";
import {
  getAmmConfigAddress,
  getClmmTickArrayAddress,
  getClmmTickArrayBitmapExtensionAddress,
  getOrcleAccountAddress,
  getPersonalPositionAddress,
  getPoolAddress,
  getPoolVaultAddress,
  getProtocolPositionAddress,
} from "@/lib/utils/instructions";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";

const CLMM_TICK_ARRAY_SIZE = 60;
const LEGACY_TX_MAX_BYTES = 1232; // common wallet-adapter legacy tx cap

type CreateClmmPoolAndPositionParams = {
  // ammConfig: PublicKey;
  selectedFeeIndex: number;
  // tickSpacing: number;

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

export function shouldBootstrap(params: {
  priceMode: PriceMode;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  tickSpacing: number;
}): boolean {
  const { priceMode, tickLower, tickUpper, currentTick, tickSpacing } = params;

  // Full range ALWAYS needs bootstrap
  if (priceMode === PriceMode.FULL) {
    return true;
  }

  // Custom range: check if current tick is within the position's range
  const tickArraySpan = tickSpacing * CLMM_TICK_ARRAY_SIZE;

  // Get tick array start indices
  const currentTickArrayStart = tickArrayStartIndex(currentTick, tickSpacing);
  const lowerTickArrayStart = tickArrayStartIndex(tickLower, tickSpacing);
  const upperTickArrayStart = tickArrayStartIndex(tickUpper, tickSpacing);

  // Calculate all tick arrays covered by the position
  const positionTickArrays = new Set<number>();
  for (
    let arrayStart = lowerTickArrayStart;
    arrayStart <= upperTickArrayStart;
    arrayStart += tickArraySpan
  ) {
    positionTickArrays.add(arrayStart);
  }

  // If current tick array is covered by position, no bootstrap needed
  const currentTickArrayCovered = positionTickArrays.has(currentTickArrayStart);

  return !currentTickArrayCovered;
}

export function getFullRangeTicks(tickSpacing: number): {
  tickLowerIndex: number;
  tickUpperIndex: number;
} {
  const tickLowerIndex = Math.ceil(CLMM_MIN_TICK / tickSpacing) * tickSpacing;
  const tickUpperIndex = Math.floor(CLMM_MAX_TICK / tickSpacing) * tickSpacing;

  return { tickLowerIndex, tickUpperIndex };
}

export interface GetTickRangeParams {
  // Token info
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;

  // Price range (in terms of A per B)
  minPriceAperB: string; // e.g., "0.001" (lower bound)
  maxPriceAperB: string; // e.g., "100" (upper bound)

  // Pool config
  tickSpacing: number; // e.g., 60 from AMM config
}

export function getTickRange(params: GetTickRangeParams): {
  tickLowerIndex: number;
  tickUpperIndex: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
} {
  const {
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    minPriceAperB,
    maxPriceAperB,
    tickSpacing,
  } = params;

  // Ensure token0 < token1 (CLMM requirement)
  const shouldSwap =
    Buffer.compare(tokenAMint.toBuffer(), tokenBMint.toBuffer()) >= 0;
  const tokenMint0 = shouldSwap ? tokenBMint : tokenAMint;
  const tokenMint1 = shouldSwap ? tokenAMint : tokenBMint;

  // Validate prices
  const minP = Number(minPriceAperB);
  const maxP = Number(maxPriceAperB);

  if (
    !Number.isFinite(minP) ||
    !Number.isFinite(maxP) ||
    minP <= 0 ||
    maxP <= 0
  ) {
    throw new Error("Invalid min/max prices");
  }

  if (minP >= maxP) {
    throw new Error("minPrice must be less than maxPrice");
  }

  // Convert prices to ticks
  const rawLowerTick = tickFromPriceAperB({
    priceAperB: minP,
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
  });

  const rawUpperTick = tickFromPriceAperB({
    priceAperB: maxP,
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
  });

  // Round to valid tick spacing
  // Floor for lower (widen range downward)
  // Ceil for upper (widen range upward)
  let tickLowerIndex = Math.floor(rawLowerTick / tickSpacing) * tickSpacing;
  let tickUpperIndex = Math.ceil(rawUpperTick / tickSpacing) * tickSpacing;

  // Clamp to valid tick range
  tickLowerIndex = clampTick(tickLowerIndex, tickSpacing);
  tickUpperIndex = clampTick(tickUpperIndex, tickSpacing);

  // Ensure upper > lower by at least one tick spacing
  if (tickUpperIndex <= tickLowerIndex) {
    tickUpperIndex = tickLowerIndex + tickSpacing;
  }

  return {
    tickLowerIndex,
    tickUpperIndex,
    tokenMint0,
    tokenMint1,
  };
}

export function getBootstrapTicks(params: {
  currentTick: number;
  tickSpacing: number;
}): { tickLower: number; tickUpper: number } {
  const { currentTick, tickSpacing } = params;

  const tickArraySpan = tickSpacing * CLMM_TICK_ARRAY_SIZE;

  // Bootstrap range: small position near current price
  // Lower tick in previous tick array, upper in current tick array
  const tickLower = clampTick(currentTick - tickArraySpan, tickSpacing);
  const tickUpper = clampTick(currentTick + tickSpacing, tickSpacing);

  return { tickLower, tickUpper };
}

// Helper: Determine base flag for price slippage check
function determineBaseFlag(
  amount0: BN,
  amount1: BN,
  sqrtPriceX64: BN,
): boolean {
  if (amount0.isZero() && !amount1.isZero()) return false;
  if (amount1.isZero() && !amount0.isZero()) return true;

  // Calculate price from sqrtPriceX64
  const Q128 = new BN(2).pow(new BN(128));

  // priceX128 = sqrtPriceX64^2
  const priceX128 = sqrtPriceX64.mul(sqrtPriceX64);

  // Convert to bigint for division
  const a0 = BigInt(amount0.toString());
  const a1 = BigInt(amount1.toString());
  const priceNum = BigInt(priceX128.toString());
  const TWO_POW_128 = BigInt(Q128.toString());

  // Calculate required amounts for each base option
  const req1From0 = (a0 * priceNum) / TWO_POW_128;
  const req0From1 = (a1 * TWO_POW_128) / priceNum;

  const okBase0 = req1From0 <= a1;
  const okBase1 = req0From1 <= a0;

  if (okBase0 && !okBase1) return true;
  if (okBase1 && !okBase0) return false;
  if (okBase0 && okBase1) {
    // Prefer the option with less leftover
    const left1Ppm = a1 === 0n ? 0n : ((a1 - req1From0) * 1_000_000n) / a1;
    const left0Ppm = a0 === 0n ? 0n : ((a0 - req0From1) * 1_000_000n) / a0;
    return left1Ppm <= left0Ppm;
  }

  throw new Error(
    "Cannot satisfy PriceSlippageCheck with provided amounts. " +
      "Try increasing buffer or adjusting amounts.",
  );
}

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
        const {
          selectedFeeIndex,
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

        const [ammConfig] = getAmmConfigAddress(
          selectedFeeIndex,
          program.programId,
        );

        const configAccount = await program.account.ammConfig.fetch(ammConfig);
        const tickSpacing = configAccount.tickSpacing;

        // Ensure tokenMint0 < tokenMint1 (required by CLMM program)
        const shouldSwap =
          Buffer.compare(tokenAMint.toBuffer(), tokenBMint.toBuffer()) >= 0;
        const tokenMint0 = shouldSwap ? tokenBMint : tokenAMint;
        const tokenMint1 = shouldSwap ? tokenAMint : tokenBMint;

        const tokenProgram0 = await resolveTokenProgramId(tokenMint0);
        const tokenProgram1 = await resolveTokenProgramId(tokenMint1);

        // Step 1: Calculate what the current tick WILL BE after pool creation
        const futureCurrentTick = tickFromPriceAperB({
          priceAperB: Number(initialPriceAperB),
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          tokenMint0,
          tokenMint1,
        });
        console.log("🚀 ~ futureCurrentTick:", futureCurrentTick);

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
        if (priceMode === PriceMode.FULL) {
          tickLowerIndex = Math.ceil(CLMM_MIN_TICK / tickSpacing) * tickSpacing;
          tickUpperIndex =
            Math.floor(CLMM_MAX_TICK / tickSpacing) * tickSpacing;
        } else {
          const minP = Number(minPriceAperB || "");
          const maxP = Number(maxPriceAperB || "");
          if (
            !Number.isFinite(minP) ||
            !Number.isFinite(maxP) ||
            minP <= 0 ||
            maxP <= 0
          ) {
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

        // Step 4: Check if bootstrap needed
        const needsBootstrap = shouldBootstrap({
          priceMode,
          tickLower: tickLowerIndex,
          tickUpper: tickUpperIndex,
          currentTick: futureCurrentTick, // ← What pool WILL have after creation
          tickSpacing,
        });
        console.log("🚀 ~ needsBootstrap:", needsBootstrap);

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
        console.log("🚀 ~ currentTickIndex:", currentTickIndex);
        const tickArrayLowerStartIndex = tickArrayStartIndex(
          tickLowerIndex,
          tickSpacing,
        );
        console.log("🚀 ~ tickArrayLowerStartIndex:", tickArrayLowerStartIndex);
        const tickArrayUpperStartIndex = tickArrayStartIndex(
          tickUpperIndex,
          tickSpacing,
        );
        console.log("🚀 ~ tickArrayUpperStartIndex:", tickArrayUpperStartIndex);

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
        const amount1MaxAllowed = a1MaxBase;
        const liquidity = new BN(0);

        // Pre-compute implied token1/token0 price from sqrtPriceX64 for slippage bounds.
        // This helps avoid 6021 PriceSlippageCheck when liquidity=0 and base_flag is used.
        const priceNumX128 = priceX128FromSqrtPriceX64(sqrtPriceX64); // numerator, denom=2^128
        const bufferPpm = Math.floor(
          (1 + (maxAmountBufferPct ?? 0)) * 1_000_000,
        );

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
        const currentTickArrayStart = tickArrayStartIndex(
          currentTickIndex,
          tickSpacing,
        );
        console.log("🚀 ~ currentTickArrayStart:", currentTickArrayStart);
        const maxTickInCurrentArray =
          currentTickArrayStart + tickArraySpan - tickSpacing;
        const candidateUpper = clampTick(
          currentTickIndex + tickSpacing,
          tickSpacing,
        );

        // Normal case: upper stays inside current tick-array -> initialize previous + current tick arrays.
        // Edge case (current tick at end of array): candidateUpper moves into next tick-array -> initialize current + next.
        const bootstrapTickLowerIndex = clampTick(
          candidateUpper <= maxTickInCurrentArray
            ? currentTickIndex - tickArraySpan
            : currentTickIndex - tickSpacing,
          tickSpacing,
        );
        console.log("🚀 ~ bootstrapTickLowerIndex:", bootstrapTickLowerIndex);
        const bootstrapTickUpperIndex = candidateUpper;
        console.log("🚀 ~ bootstrapTickUpperIndex:", bootstrapTickUpperIndex);
        if (
          shouldBootstrapTickArrays &&
          bootstrapTickUpperIndex <= bootstrapTickLowerIndex
        ) {
          throw new Error(
            "Unable to derive bootstrap tick range for full-range pool initialization",
          );
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
          ? getPersonalPositionAddress(
              program.programId,
              bootstrapPositionNftMint.publicKey,
            )
          : undefined;

        const positionNftMint = Keypair.generate();
        const positionNftOwner = wallet.publicKey;
        const positionNftAccount = getAssociatedTokenAddressSync(
          positionNftMint.publicKey,
          positionNftOwner,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        const personalPosition = getPersonalPositionAddress(
          program.programId,
          positionNftMint.publicKey,
        );

        console.log("🚀 ~ amount0MaxAllowed:", amount0MaxAllowed.toString());
        console.log("🚀 ~ amount1MaxAllowed:", amount1MaxAllowed.toString());
        const openPosIx = await program.methods
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

        console.log(
          "🚀 ~ bootstrapAmount0MaxAllowed:",
          bootstrapAmount0MaxAllowed.toString(),
        );
        console.log(
          "🚀 ~ bootstrapAmount1MaxAllowed:",
          bootstrapAmount1MaxAllowed.toString(),
        );
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
          const { blockhash } =
            await connection.getLatestBlockhash("confirmed");
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
        const { blockhash: sizingBlockhash } =
          await connection.getLatestBlockhash("confirmed");

        const pickCu = (
          base: TransactionInstruction[],
          signers?: Keypair[],
        ) => {
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
        const pickCuRequired = (
          base: TransactionInstruction[],
          signers?: Keypair[],
        ) => {
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
        const err = e as Error;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyErr = e as any;
          const logsFromField: string[] | undefined = Array.isArray(
            anyErr?.logs,
          )
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
          console.error(
            "Failed while handling simulation logs:",
            logHandlingErr,
          );
        }
        onError(err);
        setCreateError(
          new Error(err instanceof Error ? err.message : "Unknown error"),
        );
        setIsCreating(false);
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, wallet?.publicKey, onSuccess, onError],
  );

  const createPoolAndOpenPositionV2 = useCallback(
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
        const {
          selectedFeeIndex,
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

        const shouldSwap =
          Buffer.compare(tokenAMint.toBuffer(), tokenBMint.toBuffer()) >= 0;
        const tokenMint0 = shouldSwap ? tokenBMint : tokenAMint;
        const tokenMint1 = shouldSwap ? tokenAMint : tokenBMint;

        const [ammConfig] = getAmmConfigAddress(
          selectedFeeIndex,
          program.programId,
        );

        const configAccount = await program.account.ammConfig.fetch(ammConfig);
        const tickSpacing = configAccount.tickSpacing;

        // Step 1: Calculate what the current tick WILL BE after pool creation
        const futureCurrentTick = tickFromPriceAperB({
          priceAperB: Number(initialPriceAperB),
          tokenAMint,
          tokenBMint,
          tokenADecimals: tokenADecimals,
          tokenBDecimals: tokenBDecimals,
          tokenMint0,
          tokenMint1,
        });

        console.log(
          "Pool will be created with current tick:",
          futureCurrentTick,
        );

        // Step 2: Calculate sqrtPriceX64 (this SETS the current tick)
        const sqrtPriceX64 = computeSqrtPriceX64({
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          tokenMint0,
          tokenMint1,
          priceAperB: initialPriceAperB,
        });

        const positionNftOwner = wallet.publicKey;
        const positionNftMint = Keypair.generate();
        const positionNftAccount = getAssociatedTokenAddressSync(
          positionNftMint.publicKey,
          positionNftOwner,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
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
        const amount1MaxAllowed = a1MaxBase;
        const baseFlag = determineBaseFlag(
          amount0MaxAllowed,
          amount1MaxAllowed,
          sqrtPriceX64,
        );
        const bootstrapNftMint = Keypair.generate();
        console.log(
          "🚀 ~ bootstrapNftMint:",
          bootstrapNftMint.publicKey.toBase58(),
        );

        // Step 3: Get main position range
        // Step 3: Get tick range based on price mode
        let tickLowerIndex: number;
        let tickUpperIndex: number;

        if (priceMode === PriceMode.FULL) {
          const fullRangeTicks = getFullRangeTicks(tickSpacing);
          tickLowerIndex = fullRangeTicks.tickLowerIndex;
          tickUpperIndex = fullRangeTicks.tickUpperIndex;
        } else {
          // Custom range
          if (!minPriceAperB || !maxPriceAperB) {
            throw new Error(
              "minPriceAperB and maxPriceAperB required for Custom mode",
            );
          }

          const customTickRange = getTickRange({
            tokenAMint,
            tokenBMint,
            tokenADecimals,
            tokenBDecimals,
            minPriceAperB,
            maxPriceAperB,
            tickSpacing,
          });
          tickLowerIndex = customTickRange.tickLowerIndex;
          tickUpperIndex = customTickRange.tickUpperIndex;
        }

        // Step 4: Check if bootstrap needed
        const needsBootstrap = shouldBootstrap({
          priceMode,
          tickLower: tickLowerIndex,
          tickUpper: tickUpperIndex,
          currentTick: futureCurrentTick, // ← What pool WILL have after creation
          tickSpacing,
        });
        console.log("Bootstrap needed:", needsBootstrap);

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
        // const [observationState] = getOrcleAccountAddress(
        //   poolState,
        //   program.programId,
        // );
        // const [tickArrayBitmap] = getClmmTickArrayBitmapExtensionAddress({
        //   pool: poolState,
        //   programId: program.programId,
        // });

        const tokenProgram0 = await resolveTokenProgramId(tokenMint0);
        const tokenProgram1 = await resolveTokenProgramId(tokenMint1);

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

        // Step 5: CREATE POOL (this sets tickCurrent = futureCurrentTick)
        // const safeOpenTime = await getSafeOpenTime(connection);
        // await program.methods
        //   .createPool(sqrtPriceX64, safeOpenTime)
        //   .accounts({
        //     poolCreator: wallet.publicKey,
        //     ammConfig,
        //     poolState,
        //     tokenMint0,
        //     tokenMint1,
        //     tokenVault0,
        //     tokenVault1,
        //     observationState,
        //     tickArrayBitmap,
        //     tokenProgram0,
        //     tokenProgram1,
        //   })
        //   .rpc();

        // console.log("✅ Pool created:", createPoolTx);
        // await connection.confirmTransaction(createPoolTx);

        // NOW the pool exists with tickCurrent = futureCurrentTick!

        // Create ATA instructions (idempotent - won't fail if already exists)
        // const ataInstructions = [
        //   createAssociatedTokenAccountIdempotentInstruction(
        //     wallet.publicKey,
        //     ownerToken0,
        //     wallet.publicKey,
        //     tokenMint0,
        //     tokenProgram0,
        //   ),
        //   createAssociatedTokenAccountIdempotentInstruction(
        //     wallet.publicKey,
        //     ownerToken1,
        //     wallet.publicKey,
        //     tokenMint1,
        //     tokenProgram1,
        //   ),
        // ];

        // Execute ATA creation if needed
        // if (ataInstructions.length > 0) {
        //   const tx = new Transaction().add(...ataInstructions);
        //   tx.feePayer = wallet.publicKey;
        //   const { blockhash } =
        //     await connection.getLatestBlockhash("confirmed");
        //   tx.recentBlockhash = blockhash;
        //   if (signers.length > 0) tx.partialSign(...signers);
        //   const signed = await wallet.signTransaction(tx);
        //   const raw = signed.serialize();
        //   const sig = await connection.sendRawTransaction(raw, {
        //     // Solayer RPCs can be flaky with simulate/preflight; skip it there.
        //     skipPreflight: isSolayer,
        //     preflightCommitment: "confirmed",
        //     maxRetries: 5,
        //   });
        //   try {
        //     const ataSig = await connection.sendRawTransaction(
        //       ataTx.serialize(),
        //       {
        //         skipPreflight: false,
        //         preflightCommitment: "confirmed",
        //         maxRetries: 5,
        //       },
        //     );
        //     console.log("✅ Token accounts created/verified");
        //   } catch (e) {
        //     console.log("Token accounts already exist or error:", e);
        //   }
        // }

        // Step 6: Bootstrap if needed
        if (needsBootstrap) {
          const { tickLower: bsLower, tickUpper: bsUpper } = getBootstrapTicks({
            currentTick: futureCurrentTick, // ← Now this is the actual pool's tickCurrent
            tickSpacing,
          });

          const bootstrapTickArrayLowerStartIndex = tickArrayStartIndex(
            bsLower,
            tickSpacing,
          );
          const bootstrapTickArrayUpperStartIndex = tickArrayStartIndex(
            bsUpper,
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
            tickLowerIndex: bsLower,
            tickUpperIndex: bsUpper,
            programId: program.programId,
          });

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

          const bootstrapPositionNftMint = Keypair.generate();
          const bootstrapPositionNftAccount = bootstrapPositionNftMint
            ? getAssociatedTokenAddressSync(
                bootstrapPositionNftMint.publicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID,
              )
            : undefined;
          const bootstrapPersonalPosition = bootstrapPositionNftMint
            ? getPersonalPositionAddress(
                program.programId,
                bootstrapPositionNftMint.publicKey,
              )
            : undefined;

          const bootstrapOpenPositionTx = await program.methods
            .openPositionWithToken22Nft(
              bsLower,
              bsUpper,
              bootstrapTickArrayLowerStartIndex,
              bootstrapTickArrayUpperStartIndex,
              new BN(0),
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
            .signers([bootstrapNftMint])
            .rpc();
          console.log("🚀 ~ bootstrapOpenPositionTx:", bootstrapOpenPositionTx);

          const status = await pollSignatureStatus({
            connection,
            signature: bootstrapOpenPositionTx,
            timeoutMs: 120000,
          });
          console.log("🚀 ~ status:", status);
          if (!status) {
            onError(
              new Error("TransactionNotFoundOnChain"),
              bootstrapOpenPositionTx,
            );
            return undefined;
          }
        }

        const tickArrayLowerStartIndex = tickArrayStartIndex(
          tickLowerIndex,
          tickSpacing,
        );
        console.log("🚀 ~ tickArrayLowerStartIndex:", tickArrayLowerStartIndex);
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
        const personalPosition = getPersonalPositionAddress(
          program.programId,
          positionNftMint.publicKey,
        );

        console.log(
          "🚀 ~ positionNftMint:",
          positionNftMint.publicKey.toBase58(),
        );
        // // Step 7: Main position
        const openPositionTx = await program.methods
          .openPositionWithToken22Nft(
            tickLowerIndex,
            tickUpperIndex,
            tickArrayLowerStartIndex,
            tickArrayUpperStartIndex,
            new BN(0),
            amount0MaxAllowed,
            amount1MaxAllowed,
            withMetadata,
            baseFlag,
          )
          .accounts({
            payer: wallet.publicKey,
            positionNftOwner: positionNftOwner,
            positionNftMint: positionNftMint.publicKey,
            positionNftAccount,
            poolState,
            protocolPosition,
            tickArrayLower,
            tickArrayUpper,
            personalPosition,
            tokenAccount0: ownerToken0,
            tokenAccount1: ownerToken1,
            tokenVault0,
            tokenVault1,
            vault0Mint: tokenMint0,
            vault1Mint: tokenMint1,
            // rent: SYSVAR_RENT_PUBKEY,
            // systemProgram: SystemProgram.programId,
            // tokenProgram: TOKEN_PROGRAM_ID,
            // associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            // tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            // Add metadata program if withMetadata=true
            // metadataProgram: METADATA_PROGRAM_ID,
          })
          .signers([positionNftMint])
          .rpc();
        console.log("🚀 ~ openPositionTx:", openPositionTx);

        const status = await pollSignatureStatus({
          connection,
          signature: openPositionTx,
          timeoutMs: 120000,
        });
        if (!status) {
          onError(new Error("TransactionNotFoundOnChain"), openPositionTx);
          return undefined;
        }
        setIsCreating(false);
        setCreateError(undefined);
        onSuccess(openPositionTx);
        return openPositionTx;
      } catch (e) {
        const err = e as Error;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyErr = e as any;
          const logsFromField: string[] | undefined = Array.isArray(
            anyErr?.logs,
          )
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
          console.error(
            "Failed while handling simulation logs:",
            logHandlingErr,
          );
        }
        onError(err);
        setCreateError(
          new Error(err instanceof Error ? err.message : "Unknown error"),
        );
        setIsCreating(false);
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, wallet?.publicKey, onSuccess, onError],
  );

  return {
    createPoolAndPosition,
    createPoolAndOpenPositionV2,
    isCreating,
    createError,
  };
}
