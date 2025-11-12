import { BN, utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// ==============================================
// Calculation constants
// ==============================================
export const BPS = 10_000; // 100%

// ==============================================
// Number constants
// ==============================================
export const MAX_UINT128 = new BN("340282366920938463463374607431768211455");
export const ZERO = new BN(0);
export const ONE_E9 = new BN(1e9); // 1
export const ONE_MILLION_E9 = new BN(1_000_000e9); // 1,000,000
export const MINIMUM_CAP_E9 = new BN(0.01e9); // 0.01

// ==============================================
// Settings constants
// ==============================================
export const DEFAULT_SLIPPAGE_BPS = 10; // 0.1%
export const DEFAULT_SLIPPAGE = ((DEFAULT_SLIPPAGE_BPS / BPS) * 100).toString(); // 0.1%

// ==============================================
// SPL Token program ids (classic + 2022)
// ==============================================
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

// ==============================================
// Bytes code for amm instruction seeds
// ==============================================
export const POOL_LPMINT_SEED = Buffer.from(
  utils.bytes.utf8.encode("pool_lp_mint"),
);
export const POOL_VAULT_SEED = Buffer.from(
  utils.bytes.utf8.encode("pool_vault"),
);
export const POOL_SEED = Buffer.from(utils.bytes.utf8.encode("pool"));
export const POOL_AUTH_SEED = Buffer.from(
  utils.bytes.utf8.encode("vault_and_lp_mint_auth_seed"),
);
export const ORACLE_SEED = Buffer.from(utils.bytes.utf8.encode("observation"));
