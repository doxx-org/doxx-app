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
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/constants";
import { CHAIN, clientEnvConfig } from "@/lib/config/envConfig";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import {
  getOrcleAccountAddress,
  getPoolAddress,
  getPoolVaultAddress,
} from "@/lib/utils/instructions";
import { parseAmountBN } from "@/lib/utils";

type PriceMode = "Full" | "Custom";

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

// Raydium CLMM tick range (see IDL errors 6008/6009)
const MIN_TICK = -443_636;
const MAX_TICK = 443_636;
const LOG_1P0001 = Math.log(1.0001);
const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");

const CLMM_TICK_ARRAY_SIZE = 60;
const TICK_ARRAY_SEED = Buffer.from("tick_array", "utf8");
const PROTOCOL_POSITION_SEED = Buffer.from("protocol_position", "utf8");
const SEED_POSITION = Buffer.from("position", "utf8");
const CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED = Buffer.from(
  // "pool_tick_array_bitmap_extension"
  [
    112, 111, 111, 108, 95, 116, 105, 99, 107, 95, 97, 114, 114, 97, 121, 95,
    98, 105, 116, 109, 97, 112, 95, 101, 120, 116, 101, 110, 115, 105, 111,
    110,
  ],
);

// NOTE: This CLMM program encodes numeric PDA seed args as big-endian bytes
// (same as the u16 amm_config index seed in this repo).
function i32ToBeBytes(num: number): Buffer {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return Buffer.from(arr);
}

const TWO_POW_128 = 1n << 128n;

function bnToBigint(bn: BN): bigint {
  return BigInt(bn.toString());
}

function bigintToBn(x: bigint): BN {
  return new BN(x.toString());
}

function mulDiv(a: bigint, b: bigint, den: bigint): bigint {
  if (den === 0n) throw new Error("mulDiv division by zero");
  return (a * b) / den;
}

function mulByPpm(x: bigint, ppm: number): bigint {
  return (x * BigInt(ppm)) / 1_000_000n;
}

function priceX128FromSqrtPriceX64(sqrtPriceX64: BN) {
  const s = bnToBigint(sqrtPriceX64);
  return s * s; // numerator, denom=2^128
}

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
      if (s0.err) throw new Error(JSON.stringify(s0.err));
      if (s0.confirmationStatus) return s0.confirmationStatus;
    }

    // Some RPCs don't reliably populate signature statuses. Fall back to getTransaction.
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx?.meta) {
        if (tx.meta.err) throw new Error(JSON.stringify(tx.meta.err));
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

async function pollSignatureStatusWithFallback(params: {
  primary: Connection;
  signature: string;
  timeoutMs: number;
}) {
  const { primary, signature, timeoutMs } = params;
  const fallbackEndpoint = getFallbackRpcForNetwork();
  const primaryEndpoint = (primary as any).rpcEndpoint as string | undefined;

  // Try primary first
  const primaryStatus = await pollSignatureStatus({
    connection: primary,
    signature,
    // Some RPCs return a signature but fail to propagate reliably.
    // Keep this short so we can quickly fall back to a public RPC.
    timeoutMs: Math.min(timeoutMs, 6_000),
  });
  if (primaryStatus) return { status: primaryStatus, endpoint: primaryEndpoint ?? "primary" };

  if (fallbackEndpoint) {
    // Then try fallback RPC (often what explorers effectively rely on)
    const fallback = new Connection(fallbackEndpoint, "confirmed");
    const fallbackStatus = await pollSignatureStatus({
      connection: fallback,
      signature,
      timeoutMs,
    });
    if (fallbackStatus) return { status: fallbackStatus, endpoint: fallbackEndpoint };
  }

  return { status: undefined, endpoint: primaryEndpoint ?? "primary" };
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

function getClmmTickArrayAddress(params: {
  pool: PublicKey;
  startTickIndex: number;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, startTickIndex, programId } = params;
  return PublicKey.findProgramAddressSync(
    [TICK_ARRAY_SEED, pool.toBuffer(), i32ToBeBytes(startTickIndex)],
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

function getProtocolPositionAddress(params: {
  pool: PublicKey;
  tickLowerIndex: number;
  tickUpperIndex: number;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, tickLowerIndex, tickUpperIndex, programId } = params;
  return PublicKey.findProgramAddressSync(
    [
      PROTOCOL_POSITION_SEED,
      pool.toBuffer(),
      i32ToBeBytes(tickLowerIndex),
      i32ToBeBytes(tickUpperIndex),
    ],
    programId,
  );
}

function pdaPersonalPosition(
  programId: PublicKey,
  positionNftMint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_POSITION, positionNftMint.toBuffer()],
    programId,
  )[0];
}

function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return 10n ** BigInt(exp);
}

function parseDecimalToFraction(value: string): { num: bigint; den: bigint } {
  const v = value.trim();
  if (!v) throw new Error("Price is required");
  if (v.startsWith("-")) throw new Error("Price must be positive");
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error("Invalid price format");

  const [intPart, fracPart = ""] = v.split(".");
  const digits = (intPart + fracPart).replace(/^0+(?=\d)/, "");
  const num = BigInt(digits || "0");
  const den = pow10(fracPart.length);
  return { num, den };
}

function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + n / x1) >> 1n;
  }
  return x0;
}

/**
 * Convert UI price "tokenA per tokenB" into CLMM sqrtPriceX64 for ordered (tokenMint0, tokenMint1).
 * CLMM defines price as (amount_token_1 / amount_token_0) in base units.
 */
function computeSqrtPriceX64(params: {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  priceAperB: string;
}): BN {
  const {
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
    priceAperB,
  } = params;

  const { num: pabNum, den: pabDen } = parseDecimalToFraction(priceAperB);
  if (pabNum === 0n) throw new Error("Price must be greater than 0");

  const aIs0 = tokenAMint.equals(tokenMint0);
  const aIs1 = tokenAMint.equals(tokenMint1);
  const bIs0 = tokenBMint.equals(tokenMint0);
  const bIs1 = tokenBMint.equals(tokenMint1);
  if ((!aIs0 && !aIs1) || (!bIs0 && !bIs1)) {
    throw new Error("Token mints do not match token0/token1 ordering");
  }

  // Pab = A/B (human). Need P10 = token1/token0 (human).
  let p10Num = pabNum;
  let p10Den = pabDen;
  const token0Decimals = aIs0 ? tokenADecimals : tokenBDecimals;
  const token1Decimals = aIs0 ? tokenBDecimals : tokenADecimals;
  if (aIs0) {
    p10Num = pabDen;
    p10Den = pabNum;
  }

  // Convert to base-unit ratio: price_base = price_human * 10^(dec1-dec0)
  const decDiff = token1Decimals - token0Decimals;
  if (decDiff >= 0) p10Num = p10Num * pow10(decDiff);
  else p10Den = p10Den * pow10(-decDiff);

  const scaled = (p10Num << 128n) / p10Den;
  const sqrt = bigintSqrt(scaled);
  const maxU128 = (1n << 128n) - 1n;
  if (sqrt < 0n || sqrt > maxU128) throw new Error("Price out of supported range");
  return new BN(sqrt.toString());
}

function clampTick(t: number, spacing: number) {
  const minAllowed = Math.ceil(MIN_TICK / spacing) * spacing;
  const maxAllowed = Math.floor(MAX_TICK / spacing) * spacing;
  return Math.min(maxAllowed, Math.max(minAllowed, t));
}

/**
 * Convert UI price (A/B) into tick index for ordered (token0, token1).
 * Tick is based on base-unit price = token1/token0 * 10^(dec1-dec0).
 *
 * We compute in log space to avoid overflow.
 */
function tickFromPriceAperB(params: {
  priceAperB: number;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
}): number {
  const {
    priceAperB,
    tokenAMint,
    tokenBMint,
    tokenADecimals,
    tokenBDecimals,
    tokenMint0,
    tokenMint1,
  } = params;

  const aIs0 = tokenAMint.equals(tokenMint0);
  const aIs1 = tokenAMint.equals(tokenMint1);
  const bIs0 = tokenBMint.equals(tokenMint0);
  const bIs1 = tokenBMint.equals(tokenMint1);
  if ((!aIs0 && !aIs1) || (!bIs0 && !bIs1)) {
    throw new Error("Token mints do not match token0/token1 ordering");
  }

  const token0Decimals = aIs0 ? tokenADecimals : tokenBDecimals;
  const token1Decimals = aIs0 ? tokenBDecimals : tokenADecimals;

  // Pab = A/B (human). P10(human) = token1/token0 is either Pab (A=token1) or 1/Pab (A=token0).
  const safe = Math.max(priceAperB, 1e-18);
  const logP10Human = aIs0 ? -Math.log(safe) : Math.log(safe);
  const logDecScale = (token1Decimals - token0Decimals) * Math.log(10);
  const logPriceBase = logP10Human + logDecScale;

  return Math.floor(logPriceBase / LOG_1P0001);
}

function tickArrayStartIndex(tickIndex: number, tickSpacing: number): number {
  const arraySpacing = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  if (arraySpacing === 0) return 0;
  return Math.floor(tickIndex / arraySpacing) * arraySpacing;
}

function idlHasAccount(idl: DoxxClmmIdl, ixName: string, accountName: string) {
  const ix = (idl?.instructions as any[] | undefined)?.find(
    (i) => i?.name === ixName,
  );
  return !!ix?.accounts?.some((a: any) => a?.name === accountName);
}


function applyBuffer(amount: BN, bufferPct: number | undefined): BN {
  const pct = bufferPct ?? 0;
  if (!Number.isFinite(pct) || pct <= 0) return amount;
  // multiplier in ppm to avoid floats as much as possible: (1 + pct) * 1e6
  const mul = Math.floor((1 + pct) * 1_000_000);
  return amount.muln(mul).divn(1_000_000);
}

export function useCreateClmmPoolAndPosition(
  connection: Connection,
  program: Program<DoxxClmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error) => void,
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
        if (priceMode === "Full") {
          tickLowerIndex = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
          tickUpperIndex = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
        } else {
          const minP = Number(minPriceAperB || "");
          const maxP = Number(maxPriceAperB || "");
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

        const cuIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
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

        const positionNftMint = Keypair.generate();
        const positionNftOwner = wallet.publicKey;
        const positionNftAccount = getAssociatedTokenAddressSync(
          positionNftMint.publicKey,
          positionNftOwner,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        const personalPosition = pdaPersonalPosition(program.programId, positionNftMint.publicKey);

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

        const instructions = [...cuIxs, ...ataIxs, createPoolIx, openPosIx];
        const txCombined = new Transaction().add(...instructions);
        txCombined.feePayer = wallet.publicKey;
        const isSolayer = clientEnvConfig.NEXT_PUBLIC_CHAIN === CHAIN.SOLAYER;

        const signAndSend = async () => {
          // Use confirmed for better cross-node compatibility on some RPCs.
          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          txCombined.recentBlockhash = blockhash;

          // Avoid Anchor's fixed ~30s confirmation timeout by sending + polling ourselves.
          // Important: sign all required signers BEFORE serialization.
          // `open_position_with_token22_nft` requires the position NFT mint keypair as a signer.
          txCombined.partialSign(positionNftMint);
          const signed = await wallet.signTransaction(txCombined);
          const raw = signed.serialize();
          const sig = await connection.sendRawTransaction(raw, {
            // Solayer RPCs can be flaky with simulate/preflight; skip it there.
            skipPreflight: isSolayer,
            preflightCommitment: "confirmed",
            maxRetries: 5,
          });
          return { sig, raw };
        };

        const isBlockhashNotFound = (e: unknown) => {
          const msg =
            e && typeof e === "object" && "message" in e
              ? String((e as any).message)
              : String(e);
          return /blockhash not found/i.test(msg);
        };

        let sig: string;
        let raw: Uint8Array;
        try {
          ({ sig, raw } = await signAndSend());
        } catch (e) {
          // If the user took too long approving, the blockhash can expire.
          // Retry once with a fresh blockhash and re-sign.
          if (isBlockhashNotFound(e)) {
            ({ sig, raw } = await signAndSend());
          } else {
            throw e;
          }
        }

        // Best-effort broadcast to fallback public RPC as well (helps when primary RPC fails to propagate).
        await broadcastRawTxToFallback({ rawTx: raw, signature: sig });

        // console.log("🚀 ~ sig:", sig)
        // // Confirm at processed first to avoid needless expiry, then fetch logs via getTransaction.
        // const conf = await connection.confirmTransaction(
        //   { signature: sig, blockhash, lastValidBlockHeight },
        //   "processed",
        // );
        // console.log("🚀 ~ conf:", conf)

        // if (conf.value.err) {
        //   setIsCreating(false);
        //   const errValue = JSON.stringify(conf.value.err);
        //   onError(new Error(errValue));
        //   throw new Error(errValue);
        // }
        // console.log("🚀 ~ no error:")

        // const sig = await provider.sendAndConfirm?.(tx, [], {
        //   blockhash, commitment: "processed"
        // });

        // Confirm via primary RPC, then fallback RPC (to avoid false "not found" cases).
        const { status, endpoint } = await pollSignatureStatusWithFallback({
          primary: connection,
          signature: sig,
          timeoutMs: 120_000,
        });
        if (!status && !isSolayer) {
          throw new Error(
            `Transaction broadcast returned a signature, but it could not be found on primary or fallback RPC within timeout. ` +
              `Signature: ${sig}. Primary RPC: ${String((connection as any).rpcEndpoint ?? "unknown")}. Fallback RPC: ${endpoint}.`,
          );
        }
        // if (status === "confirmed") {
        onSuccess(sig);
        setIsCreating(false);
        return sig;
        // } else {
        //   onError(new Error("Transaction not confirmed, status: " + status));
        //   setIsCreating(false);
        //   return undefined;
        // }
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
  // const createPoolAndPosition = useCallback(
  //   async (params: CreateClmmPoolAndPositionParams) => {
  //     setIsCreating(true);
  //     setCreateError(undefined);

  //     if (!program || !wallet?.publicKey) {
  //       setIsCreating(false);
  //       setCreateError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
  //       return undefined;
  //     }

  //     const { provider } = program;
  //     if (!provider) {
  //       setIsCreating(false);
  //       setCreateError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
  //       return undefined;
  //     }

  //     try {
  //       const {
  //         ammConfig,
  //         tickSpacing,
  //         tokenAMint,
  //         tokenBMint,
  //         tokenADecimals,
  //         tokenBDecimals,
  //         initialPriceAperB,
  //         amountA,
  //         amountB,
  //         priceMode,
  //         minPriceAperB,
  //         maxPriceAperB,
  //         maxAmountBufferPct = 0.02,
  //       } = params;

  //       if (!amountA && !amountB) {
  //         throw new Error("Enter token amounts to supply liquidity");
  //       }

  //       // Ensure tokenMint0 < tokenMint1 (required by CLMM program)
  //       const shouldSwap = Buffer.compare(tokenAMint.toBuffer(), tokenBMint.toBuffer()) >= 0;
  //       const tokenMint0 = shouldSwap ? tokenBMint : tokenAMint;
  //       const tokenMint1 = shouldSwap ? tokenAMint : tokenBMint;

  //       const tokenProgram0 = await resolveTokenProgramId(tokenMint0);
  //       const tokenProgram1 = await resolveTokenProgramId(tokenMint1);

  //       const sqrtPriceX64 = computeSqrtPriceX64({
  //         tokenAMint,
  //         tokenBMint,
  //         tokenADecimals,
  //         tokenBDecimals,
  //         tokenMint0,
  //         tokenMint1,
  //         priceAperB: initialPriceAperB,
  //       });

  //       // Derive pool PDAs
  //       const [poolState] = getPoolAddress(
  //         ammConfig,
  //         tokenMint0,
  //         tokenMint1,
  //         program.programId,
  //       );
  //       const [tokenVault0] = getPoolVaultAddress(
  //         poolState,
  //         tokenMint0,
  //         program.programId,
  //       );
  //       const [tokenVault1] = getPoolVaultAddress(
  //         poolState,
  //         tokenMint1,
  //         program.programId,
  //       );
  //       const [observationState] = getOrcleAccountAddress(
  //         poolState,
  //         program.programId,
  //       );
  //       const [tickArrayBitmap] = getClmmTickArrayBitmapExtensionAddress({
  //         pool: poolState,
  //         programId: program.programId,
  //       });

  //       // User token accounts for deposits (support token2022)
  //       const ownerToken0 = getAssociatedTokenAddressSync(
  //         tokenMint0,
  //         wallet.publicKey,
  //         false,
  //         tokenProgram0,
  //       );
  //       const ownerToken1 = getAssociatedTokenAddressSync(
  //         tokenMint1,
  //         wallet.publicKey,
  //         false,
  //         tokenProgram1,
  //       );

  //       const ataIxs = [
  //         createAssociatedTokenAccountIdempotentInstruction(
  //           wallet.publicKey,
  //           ownerToken0,
  //           wallet.publicKey,
  //           tokenMint0,
  //           tokenProgram0,
  //         ),
  //         createAssociatedTokenAccountIdempotentInstruction(
  //           wallet.publicKey,
  //           ownerToken1,
  //           wallet.publicKey,
  //           tokenMint1,
  //           tokenProgram1,
  //         ),
  //       ];

  //       // Convert UI amounts to token0/token1 max amounts
  //       const amountAMax = parseAmountBN(amountA || "0", tokenADecimals);
  //       const amountBMax = parseAmountBN(amountB || "0", tokenBDecimals);
  //       const amount0MaxBase = shouldSwap ? amountBMax : amountAMax;
  //       const amount1MaxBase = shouldSwap ? amountAMax : amountBMax;

  //       const bufferPpm = Math.floor((1 + maxAmountBufferPct) * 1_000_000);
  //       const priceNumX128 = priceX128FromSqrtPriceX64(sqrtPriceX64); // denom=2^128

  //       function deriveMaxesForBaseFlag(baseFlag: boolean) {
  //         let amount0Max = amount0MaxBase;
  //         let amount1Max = amount1MaxBase;

  //         // apply buffer to both sides first
  //         if (bufferPpm > 1_000_000) {
  //           amount0Max = bigintToBn(mulByPpm(bnToBigint(amount0Max), bufferPpm));
  //           amount1Max = bigintToBn(mulByPpm(bnToBigint(amount1Max), bufferPpm));
  //         }

  //         const a0 = bnToBigint(amount0Max);
  //         const a1 = bnToBigint(amount1Max);

  //         if (baseFlag) {
  //           // base on token0 => required token1 ~= amount0Max * P
  //           const req1 = mulDiv(a0, priceNumX128, TWO_POW_128);
  //           const req1Buf = mulByPpm(req1, bufferPpm);
  //           if (req1Buf > a1) amount1Max = bigintToBn(req1Buf);
  //         } else {
  //           // base on token1 => required token0 ~= amount1Max / P
  //           const req0 = mulDiv(a1, TWO_POW_128, priceNumX128);
  //           const req0Buf = mulByPpm(req0, bufferPpm);
  //           if (req0Buf > a0) amount0Max = bigintToBn(req0Buf);
  //         }

  //         return { amount0Max, amount1Max };
  //       }

  //       // Compute ticks from price range
  //       let tickLowerIndex: number;
  //       let tickUpperIndex: number;
  //       if (priceMode === "Full") {
  //         tickLowerIndex = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
  //         tickUpperIndex = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  //       } else {
  //         const minP = Number(minPriceAperB || "");
  //         const maxP = Number(maxPriceAperB || "");
  //         if (!Number.isFinite(minP) || !Number.isFinite(maxP) || minP <= 0 || maxP <= 0) {
  //           throw new Error("Enter valid min/max prices");
  //         }
  //         const lo = Math.min(minP, maxP);
  //         const hi = Math.max(minP, maxP);
  //         const rawLower = tickFromPriceAperB({
  //           priceAperB: lo,
  //           tokenAMint,
  //           tokenBMint,
  //           tokenADecimals,
  //           tokenBDecimals,
  //           tokenMint0,
  //           tokenMint1,
  //         });
  //         const rawUpper = tickFromPriceAperB({
  //           priceAperB: hi,
  //           tokenAMint,
  //           tokenBMint,
  //           tokenADecimals,
  //           tokenBDecimals,
  //           tokenMint0,
  //           tokenMint1,
  //         });
  //         tickLowerIndex = Math.floor(rawLower / tickSpacing) * tickSpacing;
  //         tickUpperIndex = Math.ceil(rawUpper / tickSpacing) * tickSpacing;
  //       }

  //       tickLowerIndex = clampTick(tickLowerIndex, tickSpacing);
  //       tickUpperIndex = clampTick(tickUpperIndex, tickSpacing);
  //       if (tickUpperIndex <= tickLowerIndex) {
  //         tickUpperIndex = tickLowerIndex + tickSpacing;
  //       }

  //       const tickArrayLowerStartIndex = tickArrayStartIndex(
  //         tickLowerIndex,
  //         tickSpacing,
  //       );
  //       const tickArrayUpperStartIndex = tickArrayStartIndex(
  //         tickUpperIndex,
  //         tickSpacing,
  //       );

  //       const [tickArrayLower] = getClmmTickArrayAddress({
  //         pool: poolState,
  //         startTickIndex: tickArrayLowerStartIndex,
  //         programId: program.programId,
  //       });
  //       const [tickArrayUpper] = getClmmTickArrayAddress({
  //         pool: poolState,
  //         startTickIndex: tickArrayUpperStartIndex,
  //         programId: program.programId,
  //       });

  //       const [protocolPosition] = getProtocolPositionAddress({
  //         pool: poolState,
  //         tickLowerIndex,
  //         tickUpperIndex,
  //         programId: program.programId,
  //       });

  //       const cuIxs = [
  //         ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
  //         ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
  //       ];

  //       const safeOpenTime = await getSafeOpenTime(connection);

  //       const createPoolIx = await program.methods
  //         .createPool(sqrtPriceX64, safeOpenTime)
  //         .accounts({
  //           poolCreator: wallet.publicKey,
  //           ammConfig,
  //           poolState,
  //           tokenMint0,
  //           tokenMint1,
  //           tokenVault0,
  //           tokenVault1,
  //           observationState,
  //           tickArrayBitmap,
  //           tokenProgram0,
  //           tokenProgram1,
  //         })
  //         .instruction();

  //       const sendAttempt = async (baseFlag: boolean) => {
  //         // Position NFT mint is a new signer per attempt.
  //         const positionNftMint = Keypair.generate();
  //         const positionNftOwner = wallet.publicKey;
  //         const positionNftAccount = getAssociatedTokenAddressSync(
  //           positionNftMint.publicKey,
  //           positionNftOwner,
  //           false,
  //           TOKEN_2022_PROGRAM_ID,
  //         );
  //         const [personalPosition] = PublicKey.findProgramAddressSync(
  //           [Buffer.from("position", "utf8"), positionNftMint.publicKey.toBuffer()],
  //           program.programId,
  //         );

  //         // Let the program calculate liquidity based on one side (liquidity=0).
  //         const liquidity = new BN(0);
  //         const withMetadata = false;
  //         const baseFlagOpt: boolean | null = baseFlag;
  //         const { amount0Max, amount1Max } = deriveMaxesForBaseFlag(baseFlag);

  //         const openPosIx = await program.methods
  //           .openPositionWithToken22Nft(
  //             tickLowerIndex,
  //             tickUpperIndex,
  //             tickArrayLowerStartIndex,
  //             tickArrayUpperStartIndex,
  //             liquidity,
  //             amount0Max,
  //             amount1Max,
  //             withMetadata,
  //             baseFlagOpt,
  //           )
  //           .accounts({
  //             payer: wallet.publicKey,
  //             positionNftOwner,
  //             positionNftMint: positionNftMint.publicKey,
  //             positionNftAccount: positionNftAccount,
  //             poolState,
  //             protocolPosition,
  //             tickArrayLower,
  //             tickArrayUpper,
  //             personalPosition,
  //             tokenAccount0: ownerToken0,
  //             tokenAccount1: ownerToken1,
  //             tokenVault0: tokenVault0,
  //             tokenVault1: tokenVault1,
  //             vault0Mint: tokenMint0,
  //             vault1Mint: tokenMint1,
  //           })
  //           .instruction();

  //         const tx = new Transaction().add(
  //           ...cuIxs,
  //           ...ataIxs,
  //           createPoolIx,
  //           openPosIx,
  //         );
  //         const sig = await provider.sendAndConfirm?.(tx, [positionNftMint]);
  //         return { sig, positionNftMint: positionNftMint.publicKey };
  //       };

  //       // Try base on token0 first; if it fails, retry base on token1.
  //       try {
  //         const { sig, positionNftMint } = await sendAttempt(true);
  //         onSuccess(sig);
  //         setIsCreating(false);
  //         return { signature: sig, poolState, positionNftMint };
  //       } catch (e1) {
  //         try {
  //           const { sig, positionNftMint } = await sendAttempt(false);
  //           onSuccess(sig);
  //           setIsCreating(false);
  //           return { signature: sig, poolState, positionNftMint };
  //         } catch (e2) {
  //           // Surface the original error (often more relevant).
  //           throw e1;
  //         }
  //       }
  //     } catch (e) {
  //       console.log("🚀 ~ CLMM create+position error:", e);
  //       const err = e as Error;
  //       try {
  //         const anyErr = e as any;
  //         const logsFromField: string[] | undefined = Array.isArray(anyErr?.logs)
  //           ? anyErr.logs
  //           : undefined;

  //         let logs: string[] | undefined = logsFromField;

  //         // In some bundler setups `instanceof SendTransactionError` can fail,
  //         // so prefer feature-detecting `getLogs`.
  //         if (!logs && typeof anyErr?.getLogs === "function") {
  //           try {
  //             logs = await anyErr.getLogs(connection);
  //           } catch (logErr) {
  //             console.error(
  //               "Failed to fetch simulation logs via getLogs():",
  //               logErr,
  //             );
  //           }
  //         }

  //         if (logs && logs.length > 0) {
  //           console.error(
  //             "CLMM create+position simulation logs:\n" + logs.join("\n"),
  //           );
  //         } else {
  //           console.error(
  //             "No simulation logs found on error object. (If this persists, simulate the tx explicitly.)",
  //           );
  //         }
  //       } catch (logHandlingErr) {
  //         console.error("Failed while handling simulation logs:", logHandlingErr);
  //       }
  //       onError(err);
  //       setCreateError(new Error(err instanceof Error ? err.message : "Unknown error"));
  //       setIsCreating(false);
  //       return undefined;
  //     }
  //   },
  //   [program, wallet?.publicKey, onSuccess, onError, resolveTokenProgramId],
  // );

  return { createPoolAndPosition, isCreating, createError };
}

