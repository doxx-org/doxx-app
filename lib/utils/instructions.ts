import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
} from "@raydium-io/raydium-sdk-v2";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED,
  NATIVE_SOL_MINT,
  ORACLE_SEED,
  POOL_AUTH_SEED,
  POOL_LPMINT_SEED,
  POOL_SEED,
  POOL_VAULT_SEED,
  PROTOCOL_POSITION_SEED,
  SEED_POSITION,
  TICK_ARRAY_SEED,
} from "@/lib/constants";
import { DoxxClmmIdl } from "../idl";
import { i32ToBeBytes, u16ToBytes } from "./decode";

export function getPoolAddress(
  ammConfig: PublicKey,
  tokenMint0: PublicKey,
  tokenMint1: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [
      POOL_SEED,
      ammConfig.toBuffer(),
      tokenMint0.toBuffer(),
      tokenMint1.toBuffer(),
    ],
    programId,
  );
  return [address, bump];
}

export function getPoolLpMintAddress(
  pool: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_LPMINT_SEED, pool.toBuffer()],
    programId,
  );
  return [address, bump];
}

export function getPoolVaultAddress(
  pool: PublicKey,
  vaultTokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_VAULT_SEED, pool.toBuffer(), vaultTokenMint.toBuffer()],
    programId,
  );
  return [address, bump];
}

export function getAuthAddress(programId: PublicKey): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_AUTH_SEED],
    programId,
  );
  return [address, bump];
}

export function getOrcleAccountAddress(
  pool: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [ORACLE_SEED, pool.toBuffer()],
    programId,
  );
  return [address, bump];
}

export function getAmmConfigAddress(
  index: number,
  programId: PublicKey,
): [PublicKey, number] {
  const indexBuffer = u16ToBytes(index);

  // Match the script's exact derivation method
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(anchor.utils.bytes.utf8.encode("amm_config")), indexBuffer],
    programId,
  );
  return [address, bump];
}

// ======================================================
//                        CLMM
// ======================================================
export function getClmmTickArrayAddress(params: {
  pool: PublicKey;
  startTickIndex: number;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, startTickIndex, programId } = params;
  return PublicKey.findProgramAddressSync(
    // NOTE: This CLMM program encodes numeric PDA seed args as big-endian bytes
    // (same as the u16 amm_config index seed in this repo).
    [TICK_ARRAY_SEED, pool.toBuffer(), i32ToBeBytes(startTickIndex)],
    programId,
  );
}

export function getClmmTickArrayBitmapExtensionAddress(params: {
  pool: PublicKey;
  programId: PublicKey;
}): [PublicKey, number] {
  const { pool, programId } = params;
  return PublicKey.findProgramAddressSync(
    [CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED, pool.toBuffer()],
    programId,
  );
}

export function getProtocolPositionAddress(params: {
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
      // NOTE: This CLMM program encodes numeric PDA seed args as big-endian bytes
      // (same as the u16 amm_config index seed in this repo).
      i32ToBeBytes(tickLowerIndex),
      i32ToBeBytes(tickUpperIndex),
    ],
    programId,
  );
}

export function getPersonalPositionAddress(
  programId: PublicKey,
  positionNftMint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_POSITION, positionNftMint.toBuffer()],
    programId,
  )[0];
}

export function idlHasAccount(
  idl: DoxxClmmIdl,
  ixName: string,
  accountName: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = (idl?.instructions as any[] | undefined)?.find(
    (i) => i?.name === ixName,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!ix?.accounts?.some((a: any) => a?.name === accountName);
}

/**
 * Check all balances before swap
 */
export async function diagnoseSwapIssues(params: {
  connection: Connection;
  wallet: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: BN;
  poolKeys: ClmmKeys;
  poolInfo: ApiV3PoolInfoConcentratedItem;
  programId: PublicKey;
}): Promise<{
  canSwap: boolean;
  issues: string[];
}> {
  const {
    connection,
    wallet,
    inputMint,
    outputMint,
    amountIn,
    poolKeys,
    // poolInfo,
    programId,
  } = params;

  const issues: string[] = [];

  // 1. Check wallet SOL balance
  const walletBalance = await connection.getBalance(wallet);
  console.log("💰 Wallet SOL:", walletBalance / LAMPORTS_PER_SOL);

  if (walletBalance < 0.01 * LAMPORTS_PER_SOL) {
    issues.push(
      `Wallet needs at least 0.01 SOL for fees. Current: ${
        walletBalance / LAMPORTS_PER_SOL
      } SOL`,
    );
  }

  // 2. Check program account balance
  const programBalance = await connection.getBalance(programId);
  console.log("🏦 Program balance:", programBalance / LAMPORTS_PER_SOL, "SOL");

  if (programBalance < 0.01 * LAMPORTS_PER_SOL) {
    issues.push(
      `Program account needs at least 0.01 SOL. Current: ${
        programBalance / LAMPORTS_PER_SOL
      } SOL`,
    );
  }

  // 3. Check input token balance
  try {
    let inputBalance = new BN(0);
    if (inputMint.toString() === NATIVE_SOL_MINT) {
      inputBalance = new BN(walletBalance);
    } else {
      const inputTokenAccount = getAssociatedTokenAddressSync(
        inputMint,
        wallet,
        false,
        TOKEN_PROGRAM_ID,
      );

      console.log("🚀 ~ inputTokenAccount:", inputTokenAccount.toString());
      const inputAccount = await getAccount(connection, inputTokenAccount);
      console.log("🚀 ~ inputAccount:", inputAccount.address.toString());
      inputBalance = new BN(inputAccount.amount);
    }

    console.log("💵 Input token balance:", inputBalance.toString());

    if (inputBalance.lt(amountIn)) {
      issues.push(
        `Insufficient input token. Have: ${inputBalance}, Need: ${amountIn}`,
      );
    }
  } catch {
    issues.push("Input token account doesn't exist");
  }

  // 4. Check pool vault balances
  try {
    console.log("🚀 ~ poolKeys.vault.A:", poolKeys.vault.A);
    const vault0Info = await connection.getTokenAccountBalance(
      new PublicKey(poolKeys.vault.A),
    );
    console.log("🚀 ~ poolKeys.vault.B:", poolKeys.vault.B);
    const vault1Info = await connection.getTokenAccountBalance(
      new PublicKey(poolKeys.vault.B),
    );

    console.log("🏊 Pool liquidity:", {
      vault0: vault0Info.value.uiAmount,
      vault1: vault1Info.value.uiAmount,
    });

    if (vault0Info.value.uiAmount === 0 || vault1Info.value.uiAmount === 0) {
      issues.push("Pool has no liquidity in one or both vaults");
    }
  } catch {
    issues.push("Could not fetch pool vault balances");
  }

  // 5. Check output token account exists
  try {
    const outputTokenAccount = getAssociatedTokenAddressSync(
      outputMint,
      wallet,
      false,
      TOKEN_PROGRAM_ID,
    );

    const outputAccountInfo =
      await connection.getAccountInfo(outputTokenAccount);

    if (!outputAccountInfo) {
      console.log("⚠️ Output token account will be created during swap");
    } else {
      console.log("✅ Output token account exists");
    }
  } catch {
    // Not critical - will be created
  }

  return {
    canSwap: issues.length === 0,
    issues,
  };
}
