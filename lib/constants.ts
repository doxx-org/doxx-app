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
// Bytes code for cpmm instruction seeds
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

// ==============================================
// Display Number constants
// ==============================================
export const MAXIMUM_100_MILLION = 1_000_000_000;

// ==============================================
// CLMM constants
// ==============================================
export const TWO_POW_128 = 1n << 128n;
// Raydium CLMM tick range (see IDL errors 6008/6009)
export const CLMM_MIN_TICK = -443_636;
export const CLMM_MAX_TICK = 443_636;
export const LOG_1P0001 = Math.log(1.0001);
export const CLMM_TICK_ARRAY_SIZE = 60;
export const TICK_ARRAY_SEED = Buffer.from("tick_array", "utf8");
export const PROTOCOL_POSITION_SEED = Buffer.from("protocol_position", "utf8");
export const SEED_POSITION = Buffer.from("position", "utf8");
export const CLMM_TICK_ARRAY_BITMAP_EXTENSION_SEED = Buffer.from(
  // "pool_tick_array_bitmap_extension"
  [
    112, 111, 111, 108, 95, 116, 105, 99, 107, 95, 97, 114, 114, 97, 121, 95,
    98, 105, 116, 109, 97, 112, 95, 101, 120, 116, 101, 110, 115, 105, 111,
    110,
  ],
);