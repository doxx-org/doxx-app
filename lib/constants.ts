import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const DEFAULT_SLIPPAGE = "0.1"; // 0.1%

// SPL Token program ids (classic + 2022)
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

// bytes code for amm instruction seeds
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
