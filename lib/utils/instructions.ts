import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  ORACLE_SEED,
  POOL_AUTH_SEED,
  POOL_LPMINT_SEED,
  POOL_SEED,
  POOL_VAULT_SEED,
} from "@/lib/constants";

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
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(index, 0);

  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(utils.bytes.utf8.encode("amm_config")), indexBuffer],
    programId,
  );
  return [address, bump];
}
