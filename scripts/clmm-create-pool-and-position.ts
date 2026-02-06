
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
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { clientEnvConfig } from "../lib/config/envConfig";

import clmmIdlDevnet from "../lib/idl/devnet/clmm_devnet_idl.json";
import clmmIdlMainnet from "../lib/idl/mainnet/clmm_mainnet_idl.json";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { doxxClmmIdl, DoxxClmmIdl } from "@/lib/idl";
import { doxxClmmIdlMainnet } from "@/lib/idl/mainnet";
import { doxxClmmIdlDevnet } from "@/lib/idl/devnet";

const BN = anchor.BN;

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
  mode: "Full" | "Custom";
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
  idl: (process.env.NEXT_PUBLIC_NETWORK!! === WalletAdapterNetwork.Mainnet ? doxxClmmIdlMainnet : doxxClmmIdlDevnet) as DoxxClmmIdl,
  feeIndex: 1,

  // Solayer devnet defaults from `lib/config/addresses/address.devnet.json`
  tokenA: "9v5VCdbLZveXTJ35MPGb1HHQxEN1XHBNZinqz44gUzSC",
  tokenB: "He1JHswhPCYYJ2WK2c7JgVVQyKBPaKxB6SDXzCKhqUj7",
  decA: 9,
  decB: 6,

  initialPriceAperB: "0.01",
  amountA: "10",
  amountB: "10",
  maxAmountBufferPct: "0.02", // +2% buffer to pass PriceSlippageCheck (6021)

  mode: "Full",
  // minPriceAperB: "0.005",
  // maxPriceAperB: "0.02",

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

function parseNumber(n: string | undefined, label: string): number {
  const v = Number(n);
  if (!Number.isFinite(v)) throw new Error(`Invalid number for ${label}: ${n}`);
  return v;
}

function applyBuffer(amount: anchor.BN, bufferPct: string | undefined): anchor.BN {
  const pct = Number(bufferPct ?? "0");
  if (!Number.isFinite(pct) || pct <= 0) return amount;
  // multiplier in ppm to avoid floats as much as possible: (1 + pct) * 1e6
  const mul = Math.floor((1 + pct) * 1_000_000);
  return amount.muln(mul).divn(1_000_000);
}

const TWO_POW_128 = 1n << 128n;

function bnToBigint(bn: anchor.BN): bigint {
  return BigInt(bn.toString());
}

function bigintToBn(x: bigint): anchor.BN {
  return new anchor.BN(x.toString());
}

function mulDiv(a: bigint, b: bigint, den: bigint): bigint {
  if (den === 0n) throw new Error("mulDiv division by zero");
  return (a * b) / den;
}

function mulByPpm(x: bigint, ppm: number): bigint {
  return (x * BigInt(ppm)) / 1_000_000n;
}

function priceX128FromSqrtPriceX64(sqrtPriceX64: anchor.BN) {
  // sqrtPriceX64 is Q64.64 of sqrt(P). So P is Q128.128:
  // priceX128 = sqrt^2 (denominator is 2^128)
  const s = bnToBigint(sqrtPriceX64);
  return s * s; // numerator for P with denominator 2^128
}

function loadKeypair(keypairPath: string): Keypair {
  const p = expandHome(keypairPath);
  if (!p) throw new Error("Invalid keypair path");
  const raw = fs.readFileSync(p, "utf8");
  const arr = JSON.parse(raw);
  const secret = Uint8Array.from(arr);
  return Keypair.fromSecretKey(secret);
}

// ---------- Math helpers ----------
// IMPORTANT: This Raydium CLMM program supports tick range [-443636, 443636]
// (see IDL errors 6008/6009).
const MIN_TICK = -443_636;
const MAX_TICK = 443_636;
const LOG_1P0001 = Math.log(1.0001);
const CLMM_TICK_ARRAY_SIZE = 60;

function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return 10n ** BigInt(exp);
}

function parseDecimalToFraction(value: string): { num: bigint; den: bigint } {
  const v = String(value ?? "").trim();
  if (!v) throw new Error("Price is required");
  if (v.startsWith("-")) throw new Error("Price must be positive");
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`Invalid price format: ${v}`);
  const [i, f = ""] = v.split(".");
  const digits = (i + f).replace(/^0+(?=\d)/, "");
  return { num: BigInt(digits || "0"), den: pow10(f.length) };
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

function u16ToBytes(num: number) {
  const arr = new ArrayBuffer(2);
  const view = new DataView(arr);
  view.setUint16(0, num, false);
  return new Uint8Array(arr);
}

function computeSqrtPriceX64(params: {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  priceAperB: string;
}): anchor.BN {
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
  if (pabNum === 0n) throw new Error("Price must be > 0");

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

  const decDiff = token1Decimals - token0Decimals;
  if (decDiff >= 0) p10Num = p10Num * pow10(decDiff);
  else p10Den = p10Den * pow10(-decDiff);

  const scaled = (p10Num << 128n) / p10Den;
  const sqrt = bigintSqrt(scaled);
  const maxU128 = (1n << 128n) - 1n;
  if (sqrt < 0n || sqrt > maxU128) throw new Error("sqrtPriceX64 out of range");
  return new BN(sqrt.toString());
}

function clampTick(t: number, spacing: number): number {
  const minAllowed = Math.ceil(MIN_TICK / spacing) * spacing;
  const maxAllowed = Math.floor(MAX_TICK / spacing) * spacing;
  return Math.min(maxAllowed, Math.max(minAllowed, t));
}

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

  const safe = Math.max(Number(priceAperB), 1e-18);
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

// NOTE: This CLMM program encodes numeric PDA seed args as big-endian bytes
// (same as the u16 amm_config index seed in this repo).
function i32ToBeBytes(num: number): Buffer {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return Buffer.from(arr);
}

// ---------- PDA helpers (per IDL) ----------
const SEED_POOL = Buffer.from("pool", "utf8");
const SEED_POOL_VAULT = Buffer.from("pool_vault", "utf8");
const SEED_OBSERVATION = Buffer.from("observation", "utf8");
const SEED_TICK_ARRAY = Buffer.from("tick_array", "utf8");
const SEED_TICK_BITMAP_EXT = Buffer.from("pool_tick_array_bitmap_extension", "utf8");
const SEED_POSITION = Buffer.from("position", "utf8");

function pdaPool(
  programId: PublicKey,
  ammConfig: PublicKey,
  mint0: PublicKey,
  mint1: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_POOL, ammConfig.toBuffer(), mint0.toBuffer(), mint1.toBuffer()],
    programId,
  )[0];
}

function pdaVault(
  programId: PublicKey,
  poolState: PublicKey,
  mint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_POOL_VAULT, poolState.toBuffer(), mint.toBuffer()],
    programId,
  )[0];
}

function pdaObservation(programId: PublicKey, poolState: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_OBSERVATION, poolState.toBuffer()],
    programId,
  )[0];
}

function pdaTickBitmap(programId: PublicKey, poolState: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_TICK_BITMAP_EXT, poolState.toBuffer()],
    programId,
  )[0];
}

function pdaTickArray(
  programId: PublicKey,
  poolState: PublicKey,
  startIndex: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_TICK_ARRAY, poolState.toBuffer(), i32ToBeBytes(startIndex)],
    programId,
  )[0];
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

function pdaAmmConfig(programId: PublicKey, index: number): PublicKey {
  const indexBuffer = u16ToBytes(index);
  return PublicKey.findProgramAddressSync([Buffer.from("amm_config"), indexBuffer], programId)[0];
}

// We don't have PDA seeds for protocol_position in the IDL.
// Probe a few common Raydium-like variants.
function protocolPositionCandidates(
  programId: PublicKey,
  poolState: PublicKey,
  tickLower: number,
  tickUpper: number,
): PublicKey[] {
  const candidates = [];

  // Variant A: "position" + pool + i32 + i32 (common in Raydium)
  candidates.push(
    PublicKey.findProgramAddressSync(
      [SEED_POSITION, poolState.toBuffer(), i32ToBeBytes(tickLower), i32ToBeBytes(tickUpper)],
      programId,
    )[0],
  );

  // Variant B: "protocol_position" + pool + i32 + i32 (what UI/hook previously assumed)
  candidates.push(
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("protocol_position", "utf8"),
        poolState.toBuffer(),
        i32ToBeBytes(tickLower),
        i32ToBeBytes(tickUpper),
      ],
      programId,
    )[0],
  );

  // Variant C: "protocol_position" + pool (less likely)
  candidates.push(
    PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_position", "utf8"), poolState.toBuffer()],
      programId,
    )[0],
  );

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
    // If RPC doesn't return logs, decode common Anchor framework error codes.
    try {
      const ixErr = (sim.value.err as any)?.InstructionError;
      const custom = Array.isArray(ixErr) ? ixErr[1]?.Custom : undefined;
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
      await connection.getLatestBlockhash("processed");

    const freshTx = new Transaction().add(...instructions);
    freshTx.feePayer = walletKp.publicKey;
    freshTx.recentBlockhash = blockhash;
    freshTx.partialSign(walletKp, ...extraSigners);

    let sig: string;
    try {
      sig = await connection.sendRawTransaction(freshTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "processed",
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

    const pollStatus = async () => {
      const started = Date.now();
      const timeoutMs = 35_000;
      while (Date.now() - started < timeoutMs) {
        const st = await connection.getSignatureStatuses([sig], {
          searchTransactionHistory: true,
        });
        const s0 = st.value[0];
        if (s0) {
          if (s0.err) throw new Error(JSON.stringify(s0.err));
          if (s0.confirmationStatus) return s0.confirmationStatus;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      return undefined;
    };

    try {
      // Confirm at processed first to avoid needless expiry, then fetch logs via getTransaction.
      const conf = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "processed",
      );

      if (conf.value.err) {
        throw new Error(JSON.stringify(conf.value.err));
      }

      // Extra safety: some RPCs return "expired" incorrectly; polling status is more reliable.
      await pollStatus();

      // Best-effort: fetch log messages after confirmation (some RPCs may not support it).
      try {
        const parsed = await connection.getTransaction(sig, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        const logs = parsed?.meta?.logMessages;
        if (logs?.length) {
          console.log("\n--- onchain logs (getTransaction) ---\n" + logs.join("\n"));
        } else {
          console.log("(no logMessages from getTransaction)");
        }
      } catch (e) {
        const msg =
          e && typeof e === "object" && "message" in e ? (e as any).message : e;
        console.log("(getTransaction not available / no logs)", String(msg ?? e));
      }

      return sig;
    } catch (e) {
      lastErr = e;
      const msg = e && typeof e === "object" && "message" in e ? (e as any).message : e;
      const str = String(msg ?? e);
      if (str.includes("block height exceeded") || str.includes("TransactionExpiredBlockheightExceededError")) {
        // Blockhash expiry can be a false-negative on some RPCs. Verify by status/tx fetch.
        try {
          const status = await pollStatus();
          if (status) {
            console.log(`confirm: RPC reported expiry but status is ${status}; treating as success.`);
            return sig;
          }
        } catch (statusErr) {
          // If status says err, surface it.
          throw statusErr;
        }

        // Last resort: try getTransaction (search history) to detect success.
        try {
          const parsed = await connection.getTransaction(sig, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });
          if (parsed?.meta) {
            if (parsed.meta.err) throw new Error(JSON.stringify(parsed.meta.err));
            console.log("confirm: found transaction on-chain despite expiry; treating as success.");
            return sig;
          }
        } catch {
          // ignore and retry
        }

        console.log("confirm: blockhash expired and status unknown, retrying with fresh blockhash...");
        continue;
      }
      throw e;
    }
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

function idlHasAccount(idl: DoxxClmmIdl, ixName: string, accountName: string) {
  const ix = (idl?.instructions as any[] | undefined)?.find(
    (i) => i?.name === ixName,
  );
  return !!ix?.accounts?.some((a: any) => a?.name === accountName);
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

  // Choose IDL: devnet vs mainnet uses same program id in your repo, but keep option.
  const idl: DoxxClmmIdl = CONFIG.idl;
  const programId = new PublicKey(idl.address);
  console.log("🚀 ~ programId:", programId.toString())

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

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program<DoxxClmmIdl>(doxxClmmIdl, provider);

  console.log("rpc:", rpc);
  console.log("programId:", programId.toBase58());
  console.log("payer:", payer.publicKey.toBase58());

  const ammConfig = pdaAmmConfig(programId, feeIndex);
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

  const poolState = pdaPool(programId, ammConfig, mint0, mint1);
  const vault0 = pdaVault(programId, poolState, mint0);
  const vault1 = pdaVault(programId, poolState, mint1);
  const observation = pdaObservation(programId, poolState);
  const tickBitmap = pdaTickBitmap(programId, poolState);

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
  if (mode === "Full") {
    tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
    tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  } else {
    const lo = Math.min(parseNumber(min, "--min"), parseNumber(max, "--max"));
    const hi = Math.max(parseNumber(min, "--min"), parseNumber(max, "--max"));
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

  const taLowerStart = tickArrayStartIndex(tickLower, tickSpacing);
  const taUpperStart = tickArrayStartIndex(tickUpper, tickSpacing);
  const tickArrayLower = pdaTickArray(programId, poolState, taLowerStart);
  const tickArrayUpper = pdaTickArray(programId, poolState, taUpperStart);

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
  const personalPosition = pdaPersonalPosition(programId, positionNftMint.publicKey);

  // Protocol position candidates
  const protocolCandidates = protocolPositionCandidates(programId, poolState, tickLower, tickUpper);
  const protocolPositions = probeProtocolPosition ? protocolCandidates : [protocolCandidates[0]];

  // Instructions
  const cuIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
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
  function parseAmount(amountStr: string, decimals: number): anchor.BN {
    const s = String(amountStr);
    if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid amount: ${s}`);
    const [i, f = ""] = s.split(".");
    const frac = (f + "0".repeat(decimals)).slice(0, decimals);
    return new BN(`${i}${frac}`.replace(/^0+(?=\d)/, "") || "0");
  }
  const amountAMax = parseAmount(amountA, decA);
  const amountBMax = parseAmount(amountB, decB);
  // Apply a small buffer so the program's internal price/liquidity rounding doesn't trip slippage checks.
  const a0MaxBase = applyBuffer(
    shouldSwap ? amountBMax : amountAMax,
    CONFIG.maxAmountBufferPct,
  );
  const a1MaxBase = applyBuffer(
    shouldSwap ? amountAMax : amountBMax,
    CONFIG.maxAmountBufferPct,
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
  const bootstrapTickArrayLower = pdaTickArray(programId, poolState, bootstrapTaLowerStart);
  const bootstrapTickArrayUpper = pdaTickArray(programId, poolState, bootstrapTaUpperStart);
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
    ? pdaPersonalPosition(programId, bootstrapPositionNftMint.publicKey)
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
              vault0Mint: mint0,
              vault1Mint: mint1,
            })
            .instruction()
        : undefined;

    const instructions = [
      ...cuIxs,
      ...ataIxs,
      createPoolIx,
      ...(bootstrapOpenPosIx ? [bootstrapOpenPosIx] : []),
      openPosIx,
    ];

    const txCombined = new Transaction().add(...instructions);
    txCombined.feePayer = payer.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("processed");
    txCombined.recentBlockhash = blockhash;
    txCombined.partialSign(
      payer,
      ...(bootstrapPositionNftMint ? [bootstrapPositionNftMint] : []),
      positionNftMint,
    );

    if (!doSend) {
      if (doSplit) {
        console.log(
          "\n(note) You are simulating split txs. Simulation does not persist state, so phase2 will fail unless phase1 was already sent on-chain.\n" +
          "To validate end-to-end via simulation, use splitTx=false (combined simulation), or set send=true to actually create the pool first.",
        );

        const tx1Instructions = [
          ...cuIxs,
          ...ataIxs,
          createPoolIx,
        ];
        const tx1 = new Transaction().add(...tx1Instructions);
        tx1.feePayer = payer.publicKey;
        tx1.recentBlockhash = blockhash;
        tx1.partialSign(payer);
        await trySimulate(connection, "create_pool (phase1)", tx1Instructions, [
          payer,
        ]);

        // If pool doesn't already exist on-chain, phase2 simulation will always fail.
        const poolInfo = await connection.getAccountInfo(poolState, "processed");
        if (!poolInfo) {
          await trySimulate(connection, "combined (recommended)", instructions, [
            payer,
            positionNftMint,
          ]);
          continue;
        }

        const tx2Instructions = [...cuIxs, openPosIx];
        const tx2 = new Transaction().add(...tx2Instructions);
        tx2.feePayer = payer.publicKey;
        tx2.recentBlockhash = blockhash;
        tx2.partialSign(payer, positionNftMint);
        await trySimulate(connection, "open_position_with_token22_nft (phase2)", tx2Instructions, [
          payer,
          positionNftMint,
        ]);
      } else {
        await trySimulate(connection, "combined", instructions, [
          payer,
          positionNftMint,
        ]);
      }
      continue;
    }

    if (doSplit) {
      const tx1 = new Transaction().add(...cuIxs, ...ataIxs, createPoolIx);
      await sendTx(connection, payer, tx1, "create_pool (phase1)");

      if (bootstrapOpenPosIx && bootstrapPositionNftMint) {
        const tx2 = new Transaction().add(...cuIxs, bootstrapOpenPosIx);
        await sendTx(
          connection,
          payer,
          tx2,
          "bootstrap_open_position (phase2)",
          [bootstrapPositionNftMint],
        );
        const tx3 = new Transaction().add(...cuIxs, openPosIx);
        await sendTx(
          connection,
          payer,
          tx3,
          "open_position_with_token22_nft_full_range (phase3)",
          [positionNftMint],
        );
      } else {
        const tx2 = new Transaction().add(...cuIxs, openPosIx);
        await sendTx(
          connection,
          payer,
          tx2,
          "open_position_with_token22_nft (phase2)",
          [positionNftMint],
        );
      }
    } else {
      // Sign inside sendTx after blockhash is set.
      await sendTx(
        connection,
        payer,
        txCombined,
        "combined",
        [...(bootstrapPositionNftMint ? [bootstrapPositionNftMint] : []), positionNftMint],
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

