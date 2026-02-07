
/**
 * CLMM: create pool + open position + deposit liquidity (Raydium-style) from Node.
 *
 * Why: some RPCs (e.g. Solayer devnet) may not return simulation logs to the browser,
 * so running via a script makes it easier to debug by:
 * - simulating explicitly (when supported)
 * - splitting tx into phases (create_pool first, then open_position)
 * - probing protocol_position PDA derivations
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// import clmmIdlDevnet from "../lib/idl/devnet/clmm_devnet_idl.json";
// import clmmIdlMainnet from "../lib/idl/mainnet/clmm_mainnet_idl.json";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { doxxClmmIdl, DoxxClmmIdl } from "@/lib/idl";
import { doxxClmmIdlMainnet } from "@/lib/idl/mainnet";
import { doxxClmmIdlDevnet } from "@/lib/idl/devnet";
import { PriceMode } from "@/components/earn/v2/types";
import { applyBuffer, bnToBigint, clampTick, computeSqrtPriceX64, estimateLegacyTxSize, getAmmConfigAddress, getClmmTickArrayAddress, getClmmTickArrayBitmapExtensionAddress, getOrcleAccountAddress, getPersonalPositionAddress, getPoolAddress, getPoolVaultAddress, getProtocolPositionAddress, i32ToBeBytes, idlHasAccount, mulDiv, parseAmountBN, priceX128FromSqrtPriceX64, tickArrayStartIndex, tickFromPriceAperB } from "@/lib/utils";
import { CLMM_MAX_TICK, CLMM_MIN_TICK, CLMM_TICK_ARRAY_SIZE, SEED_POSITION, TWO_POW_128 } from "@/lib/constants";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";

const BN = anchor.BN;

const SYSVAR_RENT = new PublicKey("SysvarRent111111111111111111111111111111111");

// Shared accounts for open_position (IDL expects these; some RPCs resolve them incorrectly if omitted).
const openPositionProgramAccounts = {
  rent: SYSVAR_RENT,
  systemProgram: SystemProgram.programId,
  tokenProgram: TOKEN_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  tokenProgram2022: TOKEN_2022_PROGRAM_ID,
};

// ---------- Transaction size limits ----------
const LEGACY_TX_MAX_BYTES = 1232; // common wallet-adapter legacy tx cap

// ---------- Hardcoded config ----------
type ScriptConfig = {
  rpcUrl: string;
  keypairPath: string;
  idl: DoxxClmmIdl;
  feeIndex: number;

  tokenA: string;
  tokenB: string;
  decA: number;
  decB: number;

  /** UI price: tokenA per tokenB (A/B). */
  initialPriceAperB: string;
  /** UI amounts to supply in the initial position. */
  amountA: string;
  amountB: string;
  /** Extra buffer for amount_0_max / amount_1_max slippage checks (e.g. 0.01 = +1%) */
  maxAmountBufferPct?: string;

  /** "Full" or "Custom". If Custom, set min/max. */
  mode: PriceMode;
  minPriceAperB?: string;
  maxPriceAperB?: string;

  /** If true, run create_pool then open_position separately. */
  splitTx: boolean;
  /** If true, try multiple protocol_position PDA candidates. */
  probeProtocolPosition: boolean;
  /** If true, actually send txs; otherwise simulate only. */
  send: boolean;
};

// TODO: adjust these values for your test.
const CONFIG: ScriptConfig = {
  rpcUrl: "https://devnet-rpc.solayer.org",
  keypairPath: "~/.config/solana/id.json",
  idl: (process.env.NEXT_PUBLIC_NETWORK === WalletAdapterNetwork.Mainnet ? doxxClmmIdlMainnet : doxxClmmIdlDevnet) as DoxxClmmIdl,
  feeIndex: 1,

  // Solayer devnet defaults from `lib/config/addresses/address.devnet.json`
  // tokenA: "5DA5HuM2crJLZzhrfnwLD7eA1pcHztTRR639iaaJgJTn",
  // tokenB: "9v5VCdbLZveXTJ35MPGb1HHQxEN1XHBNZinqz44gUzSC",
  tokenA: "So11111111111111111111111111111111111111112",
  tokenB: "FicCKgiPHLUv7bjsY9ydSF91RKGikD8xr4U5orobWUiK",
  // tokenB: "GUewnup48zDzM5B43ZeNY6SNEYQZ93fatFJ8yuXn96zV", // create but doesn't deposit
  // tokenB: "7zHp8PnVt5VgehRUEjGLhKC73FKZXAF3i3RV4kfc51kY",
  decA: 9,
  decB: 9,

  initialPriceAperB: "0.01",
  amountA: "10",
  amountB: "10",
  maxAmountBufferPct: "0.02", // +2% buffer to pass PriceSlippageCheck (6021)

  mode: PriceMode.FULL,
  minPriceAperB: "0.005",
  maxPriceAperB: "0.02",

  // Debug toggles
  splitTx: false,
  probeProtocolPosition: false,
  send: false, // set true when ready
};
console.log("🚀 ~ CONFIG.rpcUrl:", CONFIG.rpcUrl)

function expandHome(p: string | undefined): string | undefined {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadKeypair(keypairPath: string): Keypair {
  const p = expandHome(keypairPath);
  if (!p) throw new Error("Invalid keypair path");
  const raw = fs.readFileSync(p, "utf8");
  const arr = JSON.parse(raw);
  const secret = Uint8Array.from(arr);
  return Keypair.fromSecretKey(secret);
}

// Protocol position PDA must match the program. Use same derivation as the hook (getProtocolPositionAddress).
// When probeProtocolPosition is true, we try additional variants.
function protocolPositionCandidates(
  programId: PublicKey,
  poolState: PublicKey,
  tickLower: number,
  tickUpper: number,
): PublicKey[] {
  const candidates: PublicKey[] = [];

  // Primary: "protocol_position" + pool + i32 + i32 (matches hook and this CLMM program).
  const [primary] = getProtocolPositionAddress({
    pool: poolState,
    tickLowerIndex: tickLower,
    tickUpperIndex: tickUpper,
    programId,
  });
  candidates.push(primary);

  // Only add other variants when probing.
  if (CONFIG.probeProtocolPosition) {
    candidates.push(
      PublicKey.findProgramAddressSync(
        [SEED_POSITION, poolState.toBuffer(), i32ToBeBytes(tickLower), i32ToBeBytes(tickUpper)],
        programId,
      )[0],
    );
    candidates.push(
      PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_position", "utf8"), poolState.toBuffer()],
        programId,
      )[0],
    );
  }

  return Array.from(new Set(candidates.map((c) => c.toBase58()))).map((s) => new PublicKey(s));
}

// ---------- send/sim helpers ----------
async function trySimulate(
  connection: Connection,
  label: string,
  instructions: TransactionInstruction[],
  signers: Keypair[],
) {
  try {
    const tx = new Transaction().add(...instructions);
    const { blockhash } = await connection.getLatestBlockhash("processed");
    tx.feePayer = signers[0]?.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(...signers);

    let sim: RpcResponseAndContext<SimulatedTransactionResponse>;
    try {
      sim = await (connection as any).simulateTransaction(tx, {
        commitment: "processed",
        sigVerify: false,
      });
    } catch {
      // Some RPCs reject config objects ("Invalid arguments"). Retry with no config.
      sim = await (connection as any).simulateTransaction(tx);
    }
    console.log(`\n=== simulate: ${label} ===`);
    console.log("err:", sim.value.err);
    const unitsConsumed = (sim.value as any).unitsConsumed;
    if (unitsConsumed != null) console.log("unitsConsumed:", unitsConsumed);
    // If RPC doesn't return logs, decode common Anchor framework error codes.
    try {
      const ixErr = (sim.value.err as any)?.InstructionError;
      const custom = Array.isArray(ixErr) ? ixErr[1]?.Custom : undefined;
      const errMsg = Array.isArray(ixErr) ? ixErr[1] : undefined;
      if (errMsg === "ProgramFailedToComplete" || String(errMsg).includes("ProgramFailedToComplete")) {
        console.log(
          "(hint) ProgramFailedToComplete usually means the instruction ran out of compute. " +
          "Try mode: Full range, or narrow the custom price range. Solana max is 1.4M CU/tx.",
        );
      }
      if (typeof custom === "number") {
        if (custom === 2505) {
          console.log(
            "(decoded) Anchor error 2505: REQUIRE_GT_VIOLATED (a require_gt() check failed)",
          );
        } else if (custom === 2006) {
          console.log(
            "(decoded) Anchor error 2006: CONSTRAINT_SEEDS (a PDA seeds constraint failed)",
          );
        } else if (custom === 3007) {
          console.log(
            "(decoded) Anchor error 3007: ACCOUNT_OWNED_BY_WRONG_PROGRAM (an account owner check failed)",
          );
        }
      }
    } catch {
      // ignore
    }
    if (sim.value.logs?.length) console.log(sim.value.logs.join("\n"));
    else console.log("(no logs returned by RPC)");
    return sim.value;
  } catch (e) {
    console.log(`\n=== simulate: ${label} (RPC threw) ===`);
    console.error(e);
    return undefined;
  }
}

async function sendTx(
  connection: Connection,
  walletKp: Keypair,
  tx: Transaction,
  label: string,
  extraSigners: Keypair[] = [],
) {
  console.log(`\n=== send: ${label} ===`);
  const instructions = tx.instructions;

  // Some RPCs (incl. some Solayer endpoints) can be slow/unreliable at confirmation.
  // If we hit blockhash expiry, rebuild + re-sign with a fresh blockhash and retry.
  const maxAttempts = 3;
  let lastErr: unknown = undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const freshTx = new Transaction().add(...instructions);
    freshTx.feePayer = walletKp.publicKey;
    freshTx.recentBlockhash = blockhash;
    freshTx.partialSign(walletKp, ...extraSigners);

    let sig: string;
    try {
      sig = await connection.sendRawTransaction(freshTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 5,
      });
    } catch (e) {
      lastErr = e;
      const anyErr = e as any;
      if (typeof anyErr?.getLogs === "function") {
        try {
          const logs = await anyErr.getLogs(connection);
          console.error("\n--- preflight logs (getLogs) ---\n" + logs.join("\n"));
        } catch {
          // ignore
        }
      }
      break;
    }

    console.log("signature:", sig, `(attempt ${attempt}/${maxAttempts})`);

    const status = await pollSignatureStatus({
      connection,
      signature: sig,
      timeoutMs: 120_000,
    });
    console.log("🚀 ~ status:", status)
    return sig;
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "sendTx failed"));
}

async function resolveTokenProgramId(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  const owner = info?.owner;
  return owner && owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
}

// ---------- main ----------
async function main() {
  const rpc = CONFIG.rpcUrl;
  const keypairPath = CONFIG.keypairPath;
  const feeIndex = CONFIG.feeIndex;

  const tokenA = new PublicKey(CONFIG.tokenA);
  const tokenB = new PublicKey(CONFIG.tokenB);
  const decA = CONFIG.decA;
  const decB = CONFIG.decB;
  const price = CONFIG.initialPriceAperB;
  const amountA = CONFIG.amountA;
  const amountB = CONFIG.amountB;
  const mode = CONFIG.mode;
  const min = CONFIG.minPriceAperB;
  const max = CONFIG.maxPriceAperB;

  const doSend = CONFIG.send;
  const doSplit = CONFIG.splitTx;
  const probeProtocolPosition = CONFIG.probeProtocolPosition;

  const connection = new Connection(rpc, "confirmed");
  const payer = loadKeypair(keypairPath);

  // Minimal wallet wrapper for AnchorProvider (only used for account fetch + instruction builders).
  const wallet: anchor.Wallet = {
    publicKey: payer.publicKey,
    payer,
    // Keep this loose: Anchor may pass Transaction or VersionedTransaction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signTransaction: async (tx: any) => {
      if (typeof tx?.partialSign === "function") tx.partialSign(payer);
      else if (typeof tx?.sign === "function") tx.sign([payer]);
      return tx;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signAllTransactions: async (txs: any[]) => {
      for (const t of txs) {
        if (typeof t?.partialSign === "function") t.partialSign(payer);
        else if (typeof t?.sign === "function") t.sign([payer]);
      }
      return txs;
    },
  };

  // Use IDL that matches rpcUrl so program id and PDAs match the deployed program (avoids IncorrectProgramId).
  const idl: DoxxClmmIdl = CONFIG.rpcUrl.toLowerCase().includes("devnet")
    ? (doxxClmmIdlDevnet as DoxxClmmIdl)
    : (doxxClmmIdlMainnet as DoxxClmmIdl);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program<DoxxClmmIdl>(idl, provider);
  const programId = program.programId;
  console.log("🚀 ~ programId:", programId.toString());

  console.log("rpc:", rpc);
  console.log("programId:", programId.toBase58());
  console.log("payer:", payer.publicKey.toBase58());

  const [ammConfig] = getAmmConfigAddress(feeIndex, programId);
  console.log("ammConfig:", ammConfig.toBase58(), "(index", feeIndex, ")");

  const cfg = await program.account.ammConfig.fetch(ammConfig);
  const tickSpacing = Number(cfg.tickSpacing);
  console.log("tickSpacing:", tickSpacing);
  console.log("tradeFeeRate:", String(cfg.tradeFeeRate));

  // token ordering
  const shouldSwap = Buffer.compare(tokenA.toBuffer(), tokenB.toBuffer()) >= 0;
  const mint0 = shouldSwap ? tokenB : tokenA;
  const mint1 = shouldSwap ? tokenA : tokenB;

  const tokenProgram0 = await resolveTokenProgramId(connection, mint0);
  const tokenProgram1 = await resolveTokenProgramId(connection, mint1);
  console.log("tokenProgram0:", tokenProgram0.toBase58());
  console.log("tokenProgram1:", tokenProgram1.toBase58());

  const sqrtPriceX64 = computeSqrtPriceX64({
    tokenAMint: tokenA,
    tokenBMint: tokenB,
    tokenADecimals: decA,
    tokenBDecimals: decB,
    tokenMint0: mint0,
    tokenMint1: mint1,
    priceAperB: price,
  });

  // const poolState = pdaPool(programId, ammConfig, mint0, mint1);
  const [poolState] = getPoolAddress(
    ammConfig,
    mint0,
    mint1,
    programId,
  );
  // const vault0 = pdaVault(programId, poolState, mint0);
  // const vault1 = pdaVault(programId, poolState, mint1);
  const [vault0] = getPoolVaultAddress(
    poolState,
    mint0,
    programId,
  );
  const [vault1] = getPoolVaultAddress(
    poolState,
    mint1,
    programId,
  );
  // const observation = pdaObservation(programId, poolState);
  // const tickBitmap = pdaTickBitmap(programId, poolState);
  const [observation] = getOrcleAccountAddress(
    poolState,
    program.programId,
  );
  const [tickBitmap] = getClmmTickArrayBitmapExtensionAddress({
    pool: poolState,
    programId: program.programId,
  });

  console.log("poolState:", poolState.toBase58());
  console.log("tokenMint0:", mint0.toBase58(), "tokenMint1:", mint1.toBase58());
  console.log("vault0:", vault0.toBase58());
  console.log("vault1:", vault1.toBase58());
  console.log("observation:", observation.toBase58());
  console.log("tickBitmapExt:", tickBitmap.toBase58());
  console.log("sqrtPriceX64:", sqrtPriceX64.toString());

  // ticks
  let tickLower: number;
  let tickUpper: number;
  if (mode === PriceMode.FULL) {
    tickLower = Math.ceil(CLMM_MIN_TICK / tickSpacing) * tickSpacing;
    tickUpper = Math.floor(CLMM_MAX_TICK / tickSpacing) * tickSpacing;
  } else {
    const lo = Math.min(Number(min ?? 0), Number(max ?? 0));
    console.log("🚀 ~ lo:", lo)
    const hi = Math.max(Number(min ?? 0), Number(max ?? 0));
    console.log("🚀 ~ hi:", hi)
    const rawLower = tickFromPriceAperB({
      priceAperB: lo,
      tokenAMint: tokenA,
      tokenBMint: tokenB,
      tokenADecimals: decA,
      tokenBDecimals: decB,
      tokenMint0: mint0,
      tokenMint1: mint1,
    });
    const rawUpper = tickFromPriceAperB({
      priceAperB: hi,
      tokenAMint: tokenA,
      tokenBMint: tokenB,
      tokenADecimals: decA,
      tokenBDecimals: decB,
      tokenMint0: mint0,
      tokenMint1: mint1,
    });
    tickLower = Math.floor(rawLower / tickSpacing) * tickSpacing;
    tickUpper = Math.ceil(rawUpper / tickSpacing) * tickSpacing;
  }
  tickLower = clampTick(tickLower, tickSpacing);
  tickUpper = clampTick(tickUpper, tickSpacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + tickSpacing;

  // Custom only: CLMM requires the pool's current tick to be inside [tickLower, tickUpper).
  // If the user's range doesn't include the initial price, widen the range to include it.
  if (mode !== PriceMode.FULL) {
    const currentTickFromInitialPrice = tickFromPriceAperB({
      priceAperB: Number(price),
      tokenAMint: tokenA,
      tokenBMint: tokenB,
      tokenADecimals: decA,
      tokenBDecimals: decB,
      tokenMint0: mint0,
      tokenMint1: mint1,
    });
    const currentTickAligned =
      clampTick(Math.floor(currentTickFromInitialPrice / tickSpacing) * tickSpacing, tickSpacing);
    if (currentTickAligned < tickLower) {
      tickLower = currentTickAligned;
      tickLower = clampTick(tickLower, tickSpacing);
      console.log("(Custom) widened tickLower to include initial price:", tickLower);
    }
    if (currentTickAligned >= tickUpper) {
      tickUpper = (Math.floor(currentTickFromInitialPrice / tickSpacing) + 1) * tickSpacing;
      tickUpper = clampTick(tickUpper, tickSpacing);
      if (tickUpper <= tickLower) tickUpper = tickLower + tickSpacing;
      console.log("(Custom) widened tickUpper to include initial price:", tickUpper);
    }
  }

  const taLowerStart = tickArrayStartIndex(tickLower, tickSpacing);
  const taUpperStart = tickArrayStartIndex(tickUpper, tickSpacing);
  // const tickArrayLower = pdaTickArray(programId, poolState, taLowerStart);
  // const tickArrayUpper = pdaTickArray(programId, poolState, taUpperStart);
  const [tickArrayLower] = getClmmTickArrayAddress({
    pool: poolState,
    startTickIndex: taLowerStart,
    programId: program.programId,
  });
  const [tickArrayUpper] = getClmmTickArrayAddress({
    pool: poolState,
    startTickIndex: taUpperStart,
    programId: program.programId,
  });

  console.log("tickLower:", tickLower, "tickUpper:", tickUpper);
  console.log("tickArrayLowerStart:", taLowerStart, "tickArrayUpperStart:", taUpperStart);
  console.log("tickArrayLower:", tickArrayLower.toBase58());
  console.log("tickArrayUpper:", tickArrayUpper.toBase58());

  // owner token accounts (supports Token-2022 by passing mint's token program id)
  const ownerToken0 = getAssociatedTokenAddressSync(
    mint0,
    payer.publicKey,
    false,
    tokenProgram0,
  );
  const ownerToken1 = getAssociatedTokenAddressSync(
    mint1,
    payer.publicKey,
    false,
    tokenProgram1,
  );

  // Position NFT mint + ATA (token-2022 NFT)
  const positionNftMint = Keypair.generate();
  const positionNftOwner = payer.publicKey;
  const positionNftAccount = getAssociatedTokenAddressSync(
    positionNftMint.publicKey,
    positionNftOwner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const personalPosition = getPersonalPositionAddress(programId, positionNftMint.publicKey);

  // Protocol position candidates
  const protocolCandidates = protocolPositionCandidates(programId, poolState, tickLower, tickUpper);
  const protocolPositions = probeProtocolPosition ? protocolCandidates : [protocolCandidates[0]];

  // Instructions
  // Open position can exceed default 200k CU. Use Solana's max (1.4M); custom range may still hit ProgramFailedToComplete.
  const COMPUTE_UNIT_LIMIT = 1_400_000;
  const cuIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ];

  const ataIxs = [
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ownerToken0,
      payer.publicKey,
      mint0,
      tokenProgram0,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ownerToken1,
      payer.publicKey,
      mint1,
      tokenProgram1,
    ),
  ];

  // IMPORTANT: use on-chain time, not local time (local clock skew can break create_pool)
  // create_pool requires open_time < current chain block_timestamp.
  let openTime = new BN(0);
  try {
    const slot = await connection.getSlot("processed");
    const blockTime = await connection.getBlockTime(slot);
    if (typeof blockTime === "number" && Number.isFinite(blockTime)) {
      openTime = new BN(Math.max(0, Math.floor(blockTime) - 10));
    }
  } catch {
    // fall back to 0 (always in the past)
    openTime = new BN(0);
  }

  const createPoolAccounts: Record<string, PublicKey> = {
    poolCreator: payer.publicKey,
    ammConfig,
    poolState,
    tokenMint0: mint0,
    tokenMint1: mint1,
    tokenVault0: vault0,
    tokenVault1: vault1,
    observationState: observation,
    tickArrayBitmap: tickBitmap,
    tokenProgram0: tokenProgram0,
    tokenProgram1: tokenProgram1,
    systemProgram: SystemProgram.programId,
  };
  if (idlHasAccount(idl, "create_pool", "rent") || idlHasAccount(idl, "createPool", "rent")) {
    createPoolAccounts.rent = new PublicKey("SysvarRent111111111111111111111111111111111");
  }

  const createPoolIx = await program.methods
    .createPool(sqrtPriceX64, openTime)
    .accounts({
      poolCreator: payer.publicKey,
      ammConfig,
      poolState,
      tokenMint0: mint0,
      tokenMint1: mint1,
      tokenVault0: vault0,
      tokenVault1: vault1,
      observationState: observation,
      tickArrayBitmap: tickBitmap,
      tokenProgram0: tokenProgram0,
      tokenProgram1: tokenProgram1,
    })
    .instruction();

  const liquidity = new BN(0);
  const withMetadata = false;
  const amount0Max = new BN(0); // placeholders; we’ll set based on A/B ordering below
  const amount1Max = new BN(0);
  void amount0Max;
  void amount1Max;

  // Parse amounts to token decimals (simple parser: decimal -> integer BN)
  const amountAMax = parseAmountBN(amountA, decA);
  const amountBMax = parseAmountBN(amountB, decB);
  // Apply a small buffer so the program's internal price/liquidity rounding doesn't trip slippage checks.
  const a0MaxBase = applyBuffer(
    shouldSwap ? amountBMax : amountAMax,
    Number(CONFIG.maxAmountBufferPct ?? "0"),
  );
  const a1MaxBase = applyBuffer(
    shouldSwap ? amountAMax : amountBMax,
    Number(CONFIG.maxAmountBufferPct ?? "0"),
  );

  // Pre-compute implied token1/token0 price from sqrtPriceX64 for slippage bounds.
  // This helps avoid 6021 PriceSlippageCheck when liquidity=0 and base_flag is used.
  const priceNumX128 = priceX128FromSqrtPriceX64(sqrtPriceX64); // numerator, denom=2^128
  const bufferPpm = Math.floor((1 + Number(CONFIG.maxAmountBufferPct ?? "0")) * 1_000_000);

  // Choose base_flag deterministically (no try/catch fallback).
  // We interpret maxAmountBufferPct as the user's slippage tolerance for initial position minting.
  // We will NOT increase the max amounts beyond the user's provided amounts + buffer.
  const amount0MaxAllowed = a0MaxBase;
  console.log("🚀 ~ amount0MaxAllowed:", amount0MaxAllowed.toString())
  const amount1MaxAllowed = a1MaxBase;
  console.log("🚀 ~ amount1MaxAllowed:", amount1MaxAllowed.toString())

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

  console.log("chosen base_flag:", baseFlag ? "true (base token0)" : "false (base token1)");

  // --- Bootstrap position (for Full range) ---
  // Full-range positions only initialize the *edge* tick arrays, which often leaves the *current* tick array
  // (used by swaps) uninitialized. To make the pool swappable right after creation, we open a tiny
  // additional position spanning two tick arrays around the initial tick.
  const shouldBootstrapTickArrays = mode === "Full";
  const bootstrapLiquidity = liquidity; // keep 0; program derives liquidity from max amounts + base_flag
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

  // Compute the initial/current tick from the user-provided initial price.
  const currentTickIndexRaw = tickFromPriceAperB({
    priceAperB: Number(price),
    tokenAMint: tokenA,
    tokenBMint: tokenB,
    tokenADecimals: decA,
    tokenBDecimals: decB,
    tokenMint0: mint0,
    tokenMint1: mint1,
  });
  const currentTickIndex = clampTick(
    Math.floor(currentTickIndexRaw / tickSpacing) * tickSpacing,
    tickSpacing,
  );

  const tickArraySpan = tickSpacing * CLMM_TICK_ARRAY_SIZE;
  const currentTickArrayStart = tickArrayStartIndex(currentTickIndex, tickSpacing);
  const maxTickInCurrentArray = currentTickArrayStart + tickArraySpan - tickSpacing;
  const candidateUpper = clampTick(currentTickIndex + tickSpacing, tickSpacing);

  const bootstrapTickLower = clampTick(
    candidateUpper <= maxTickInCurrentArray
      ? currentTickIndex - tickArraySpan // previous + current
      : currentTickIndex - tickSpacing, // current + next (edge case)
    tickSpacing,
  );
  const bootstrapTickUpper = candidateUpper;

  const bootstrapTaLowerStart = tickArrayStartIndex(bootstrapTickLower, tickSpacing);
  const bootstrapTaUpperStart = tickArrayStartIndex(bootstrapTickUpper, tickSpacing);
  const [bootstrapTickArrayLower] = getClmmTickArrayAddress({
    pool: poolState,
    startTickIndex: bootstrapTaLowerStart,
    programId: program.programId,
  });
  const [bootstrapTickArrayUpper] = getClmmTickArrayAddress({
    pool: poolState,
    startTickIndex: bootstrapTaUpperStart,
    programId: program.programId,
  });

  // const bootstrapTickArrayLower = pdaTickArray(programId, poolState, bootstrapTaLowerStart);
  // const bootstrapTickArrayUpper = pdaTickArray(programId, poolState, bootstrapTaUpperStart);
  const bootstrapProtocolPosition =
    protocolPositionCandidates(programId, poolState, bootstrapTickLower, bootstrapTickUpper)[0]!;

  const bootstrapPositionNftMint = shouldBootstrapTickArrays ? Keypair.generate() : undefined;
  const bootstrapPositionNftAccount = bootstrapPositionNftMint
    ? getAssociatedTokenAddressSync(
      bootstrapPositionNftMint.publicKey,
      positionNftOwner,
      false,
      TOKEN_2022_PROGRAM_ID,
    )
    : undefined;
  const bootstrapPersonalPosition = bootstrapPositionNftMint
    ? getPersonalPositionAddress(programId, bootstrapPositionNftMint.publicKey)
    : undefined;

  if (shouldBootstrapTickArrays) {
    console.log("\n--- bootstrap (swap-safety) ---");
    console.log("currentTickIndex:", currentTickIndex);
    console.log("bootstrapTickLower:", bootstrapTickLower, "bootstrapTickUpper:", bootstrapTickUpper);
    console.log(
      "bootstrapTickArrayLowerStart:",
      bootstrapTaLowerStart,
      "bootstrapTickArrayUpperStart:",
      bootstrapTaUpperStart,
    );
    console.log("bootstrapTickArrayLower:", bootstrapTickArrayLower.toBase58());
    console.log("bootstrapTickArrayUpper:", bootstrapTickArrayUpper.toBase58());
    console.log("bootstrapProtocolPosition:", bootstrapProtocolPosition.toBase58());
    console.log("bootstrapAmount0MaxAllowed:", bootstrapAmount0MaxAllowed.toString());
    console.log("bootstrapAmount1MaxAllowed:", bootstrapAmount1MaxAllowed.toString());
  }

  for (const protocolPosition of protocolPositions) {
    console.log("\n--- trying protocol_position:", protocolPosition.toBase58(), "---");

    console.log("🚀 ~ tickLower:", tickLower)
    console.log("🚀 ~ tickUpper:", tickUpper)
    console.log("🚀 ~ taLowerStart:", taLowerStart)
    console.log("🚀 ~ taUpperStart:", taUpperStart)
    console.log("🚀 ~ liquidity:", liquidity.toString())
    console.log("🚀 ~ amount0MaxAllowed:", amount0MaxAllowed.toString())
    console.log("🚀 ~ amount1MaxAllowed:", amount1MaxAllowed.toString())
    console.log("🚀 ~ withMetadata:", withMetadata)
    console.log("🚀 ~ baseFlag:", baseFlag)

    async function buildOpenPosIx() {
      return await program.methods
        .openPositionWithToken22Nft(
          tickLower,
          tickUpper,
          taLowerStart,
          taUpperStart,
          liquidity,
          amount0MaxAllowed,
          amount1MaxAllowed,
          withMetadata,
          baseFlag,
        )
        .accounts({
          payer: payer.publicKey,
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
          tokenVault0: vault0,
          tokenVault1: vault1,
          ...openPositionProgramAccounts,
          vault0Mint: mint0,
          vault1Mint: mint1,
        })
        .instruction();
    }

    let openPosIx = await buildOpenPosIx();

    const bootstrapOpenPosIx =
      shouldBootstrapTickArrays && bootstrapPositionNftMint
        ? await program.methods
          .openPositionWithToken22Nft(
            bootstrapTickLower,
            bootstrapTickUpper,
            bootstrapTaLowerStart,
            bootstrapTaUpperStart,
            bootstrapLiquidity,
            bootstrapAmount0MaxAllowed,
            bootstrapAmount1MaxAllowed,
            withMetadata,
            baseFlag,
          )
          .accounts({
            payer: payer.publicKey,
            positionNftOwner: positionNftOwner,
            positionNftMint: bootstrapPositionNftMint.publicKey,
            positionNftAccount: bootstrapPositionNftAccount!,
            poolState,
            protocolPosition: bootstrapProtocolPosition,
            tickArrayLower: bootstrapTickArrayLower,
            tickArrayUpper: bootstrapTickArrayUpper,
            personalPosition: bootstrapPersonalPosition!,
            tokenAccount0: ownerToken0,
            tokenAccount1: ownerToken1,
            tokenVault0: vault0,
            tokenVault1: vault1,
            ...openPositionProgramAccounts,
            vault0Mint: mint0,
            vault1Mint: mint1,
          })
          .instruction()
        : undefined;

    // Pre-plan tx splits based on estimated legacy serialized size.
    const { blockhash: sizingBlockhash } = await connection.getLatestBlockhash("confirmed");

    const pickCu = (base: TransactionInstruction[], signers?: Keypair[]) => {
      const withCu = [...cuIxs, ...base];
      const sizeWithCu = estimateLegacyTxSize({
        feePayer: payer.publicKey,
        recentBlockhash: sizingBlockhash,
        instructions: withCu,
        signers,
      });
      if (sizeWithCu <= LEGACY_TX_MAX_BYTES) return withCu;

      const sizeNoCu = estimateLegacyTxSize({
        feePayer: payer.publicKey,
        recentBlockhash: sizingBlockhash,
        instructions: base,
        signers,
      });
      if (sizeNoCu <= LEGACY_TX_MAX_BYTES) return base;

      return undefined;
    };

    // Position instructions need high compute; never send them without Compute Budget or we get ProgramFailedToComplete.
    const pickCuRequired = (base: TransactionInstruction[], signers?: Keypair[]) => {
      const withCu = [...cuIxs, ...base];
      const sizeWithCu = estimateLegacyTxSize({
        feePayer: payer.publicKey,
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
      // Position txs must include Compute Budget or we get ProgramFailedToComplete.
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

    if (!doSend) {
      // Simulation mode: try to simulate each planned transaction
      console.log(
        "\n(note) Simulation mode. Transactions are pre-planned based on size estimation.",
      );

      const poolInfo = await connection.getAccountInfo(poolState, "processed");
      if (!poolInfo) {
        // Pool doesn't exist: position-only sim would fail. Run one combined sim (create_pool + first position) so the program sees the pool.
        console.log(
          "\n(note) Pool doesn't exist yet. Simulating create_pool + first position in one tx.",
        );
        const firstStep = txPlan[0];
        if (firstStep) {
          const combinedIxs = [...tx1Instructions, ...firstStep.instructions];
          const combinedSigners = [payer, ...(firstStep.signers || [])];
          await trySimulate(
            connection,
            "create_pool+position (combined)",
            combinedIxs,
            combinedSigners,
          );
        } else {
          await trySimulate(connection, "create_pool", tx1Instructions, [payer]);
        }
      } else {
        for (const step of txPlan) {
          const tx = new Transaction().add(...step.instructions);
          tx.feePayer = payer.publicKey;
          tx.recentBlockhash = sizingBlockhash;
          if (step.signers && step.signers.length > 0) {
            tx.partialSign(payer, ...step.signers);
          } else {
            tx.partialSign(payer);
          }
          await trySimulate(connection, step.label, step.instructions, [
            payer,
            ...(step.signers || []),
          ]);
        }
      }
      continue;
    }

    // Important UX invariant:
    // Do NOT broadcast `create_pool` unless we were able to fully plan the follow-up
    // position txs within legacy limits. Otherwise we can create a pool without a position.
    // const tx1 = new Transaction().add(...tx1Instructions);
    // await sendTx(connection, payer, tx1, "create_pool");

    for (const step of txPlan) {
      const tx = new Transaction().add(...step.instructions);
      await sendTx(
        connection,
        payer,
        tx,
        step.label,
        step.signers || [],
      );
    }

    // If we successfully sent, stop probing.
    break;
  }
}

main().catch((e) => {
  const msg =
    e && typeof e === "object" && "message" in e ? (e as any).message : e;
  console.error("\n❌ Script failed:", msg ?? e);
  console.error(e);
  process.exit(1);
});

