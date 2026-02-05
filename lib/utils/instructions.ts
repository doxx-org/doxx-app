import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED,
  ORACLE_SEED,
  POOL_AUTH_SEED,
  POOL_LPMINT_SEED,
  POOL_SEED,
  POOL_VAULT_SEED,
  PROTOCOL_POSITION_SEED,
  SEED_POSITION,
  TICK_ARRAY_SEED,
} from "@/lib/constants";
import { i32ToBeBytes, u16ToBytes } from "./decode";
import { DoxxClmmIdl } from "../idl";

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

export function idlHasAccount(idl: DoxxClmmIdl, ixName: string, accountName: string) {
  const ix = (idl?.instructions as any[] | undefined)?.find(
    (i) => i?.name === ixName,
  );
  return !!ix?.accounts?.some((a: any) => a?.name === accountName);
}
