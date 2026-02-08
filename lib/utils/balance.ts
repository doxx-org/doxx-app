import { AccountInfo, Connection, ParsedAccountData, PublicKey, RpcResponseAndContext } from "@solana/web3.js";
import { BalanceMapByMint, SplBalance } from "../hooks/chain/types";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, unpackAccount, unpackMint } from "@solana/spl-token";
import { TokenProfile } from "../config/tokens";
import { mintSummaryCache } from "./storage";

interface AccountDataParsedInfoTokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

interface AccountDataParsedInfo {
  isNative: boolean;
  mint: string;
  owner: string;
  state: string;
  tokenAmount: AccountDataParsedInfoTokenAmount;
}

interface AccountDataParsed {
  info: AccountDataParsedInfo;
  type: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type MapFromAccountOptions = {
  includeTokenAccounts?: boolean;
  skipZeroBalances?: boolean;
  excludeNftLike?: boolean;
  onlyNftLike?: boolean;
};

const mapTokenBalanceFromAccount = (
  resp: RpcResponseAndContext<
    {
      pubkey: PublicKey;
      account: AccountInfo<ParsedAccountData>;
    }[]
  >,
  options?: MapFromAccountOptions,
): BalanceMapByMint => {
  const includeTokenAccounts = options?.includeTokenAccounts ?? true;
  const skipZeroBalances = options?.skipZeroBalances ?? false;
  const excludeNftLike = options?.excludeNftLike ?? true;
  const onlyNftLike = options?.onlyNftLike ?? false;

  const balanceMap: BalanceMapByMint = {} as BalanceMapByMint;
  for (const { pubkey, account } of resp.value) {
    const info = (account.data.parsed as AccountDataParsed).info;
    const tokenAmount = info.tokenAmount;

    const rawAmount = BigInt(tokenAmount.amount);
    if (skipZeroBalances && rawAmount === 0n) continue;
    // Heuristic filter for position-NFT-like holdings.
    // Parsed response doesn't include mint supply; use an amount-based heuristic here.
    if (excludeNftLike && (tokenAmount.decimals ?? 0) === 0 && rawAmount === 1n) continue;
    // If onlyNftLike is true, exclude all non-NFT-like mints
    if (onlyNftLike && (tokenAmount.decimals ?? 0) !== 0 && rawAmount !== 1n) continue;

    const prev = balanceMap[info.mint] ?? {
      mint: info.mint,
      rawAmount: 0n,
      amount: 0,
      decimals: tokenAmount.decimals ?? 0,
      tokenAccounts: [] as string[],
    };

    const ui =
      typeof tokenAmount.uiAmount === "number"
        ? tokenAmount.uiAmount
        : parseFloat(tokenAmount.uiAmountString ?? "0");
    prev.rawAmount += rawAmount;
    prev.amount += ui;
    prev.decimals = tokenAmount.decimals ?? prev.decimals;
    if (includeTokenAccounts) prev.tokenAccounts.push(pubkey.toBase58());
    balanceMap[info.mint] = prev;
  }

  return balanceMap;
};

async function getParsedTokenAccountsByOwnerAllTokenPrograms(
  connection: Connection,
  owner: PublicKey,
  includeToken2022: boolean,
): Promise<
  RpcResponseAndContext<
    {
      pubkey: PublicKey;
      account: AccountInfo<ParsedAccountData>;
    }[]
  >
> {
  if (!includeToken2022) {
    const legacy = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });
    return { context: legacy.context, value: legacy.value };
  }

  const [legacy, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  // Note: context slots may differ slightly; using legacy context is fine for UI.
  return {
    context: legacy.context,
    value: [...legacy.value, ...token2022.value],
  };
}

type RawTokenAccountByOwner = {
  pubkey: PublicKey;
  account: AccountInfo<Buffer>;
  programId: PublicKey;
};

export async function getTokenAccountsByOwnerAllTokenProgramsRaw(
  connection: Connection,
  owner: PublicKey,
  includeToken2022: boolean,
): Promise<RpcResponseAndContext<RawTokenAccountByOwner[]>> {
  if (!includeToken2022) {
    const legacy = await connection.getTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });
    return {
      context: legacy.context,
      value: legacy.value.map((v) => ({ ...v, programId: TOKEN_PROGRAM_ID })),
    };
  }

  const [legacy, token2022] = await Promise.all([
    connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  return {
    context: legacy.context,
    value: [
      ...legacy.value.map((v) => ({ ...v, programId: TOKEN_PROGRAM_ID })),
      ...token2022.value.map((v) => ({ ...v, programId: TOKEN_2022_PROGRAM_ID })),
    ],
  };
}

export async function mapTokenBalanceFromRawAccounts(
  connection: Connection,
  rawResp: RpcResponseAndContext<RawTokenAccountByOwner[]>,
  options?: MapFromAccountOptions,
): Promise<BalanceMapByMint> {
  const includeTokenAccounts = options?.includeTokenAccounts ?? false;
  const skipZeroBalances = options?.skipZeroBalances ?? true;
  const excludeNftLike = options?.excludeNftLike ?? true;
  const onlyNftLike = options?.onlyNftLike ?? false;

  const balanceMap: BalanceMapByMint = {} as BalanceMapByMint;
  const programIdByMint = new Map<string, PublicKey>();

  // 1) Aggregate raw token amounts by mint
  for (const { pubkey, account, programId } of rawResp.value) {
    // Some RPCs/providers occasionally return non-token accounts here (e.g. System Program owned).
    // `unpackAccount` will throw `TokenInvalidAccountOwnerError` in that case, so we defensively skip.
    const effectiveProgramId =
      account.owner.equals(TOKEN_PROGRAM_ID) || account.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? account.owner
        : programId;
    if (
      !effectiveProgramId.equals(TOKEN_PROGRAM_ID) &&
      !effectiveProgramId.equals(TOKEN_2022_PROGRAM_ID)
    ) {
      continue;
    }

    if (!account.owner.equals(effectiveProgramId)) {
      continue;
    }

    let ta: ReturnType<typeof unpackAccount>;
    try {
      ta = unpackAccount(pubkey, account, effectiveProgramId);
    } catch {
      continue;
    }
    if (skipZeroBalances && ta.amount === 0n) continue;
    const mintStr = ta.mint.toBase58();
    programIdByMint.set(mintStr, effectiveProgramId);

    const prev = balanceMap[mintStr] ?? {
      mint: mintStr,
      rawAmount: 0n,
      amount: 0,
      decimals: 0,
      tokenAccounts: [] as string[],
    };

    // spl-token returns bigint (or bigint-like); normalize via string -> BigInt
    prev.rawAmount += BigInt(ta.amount.toString());
    if (includeTokenAccounts) prev.tokenAccounts.push(pubkey.toBase58());
    balanceMap[mintStr] = prev;
  }

  // 2) Fill mint summaries from cache; only fetch missing mint infos
  const missingMintStrs = [...programIdByMint.keys()].filter(
    (mintStr) => mintSummaryCache.get(mintStr) === undefined,
  );

  // RPC limit: getMultipleAccountsInfo commonly capped (safe to chunk).
  for (const mintChunk of chunk(missingMintStrs, 100)) {
    const mintPks = mintChunk.map((m) => new PublicKey(m));
    const mintInfos = await connection.getMultipleAccountsInfo(mintPks);
    for (let i = 0; i < mintPks.length; i++) {
      const mintPk = mintPks[i]!;
      const info = mintInfos[i];
      if (!info) continue;

      const mintStr = mintPk.toBase58();
      const programId = programIdByMint.get(mintStr) ?? TOKEN_PROGRAM_ID;
      try {
        const mint = unpackMint(mintPk, info, programId);
        const decimals = mint.decimals ?? 0;
        const supply = BigInt(mint.supply.toString());
        mintSummaryCache.set(mintStr, {
          decimals,
          supply,
          isNftLike: decimals === 0 && supply === 1n,
        });
      } catch {
        // ignore
      }
    }
  }

  if (onlyNftLike) {
    for (const mintStr of [...programIdByMint.keys()]) {
      const summary = mintSummaryCache.get(mintStr);
      if (!summary?.isNftLike) {
        delete balanceMap[mintStr];
        programIdByMint.delete(mintStr);
      }
    }
  }

  // 3) Optionally filter out NFT-like mints (e.g. CLMM position NFTs).
  if (excludeNftLike) {
    for (const mintStr of [...programIdByMint.keys()]) {
      const summary = mintSummaryCache.get(mintStr);
      if (summary?.isNftLike) {
        delete balanceMap[mintStr];
        programIdByMint.delete(mintStr);
      }
    }
  }


  // 4) Compute UI amounts using cached decimals
  for (const mintStr of programIdByMint.keys()) {
    const entry = balanceMap[mintStr];
    if (!entry) continue;
    const decimals = mintSummaryCache.get(mintStr)?.decimals ?? 0;
    entry.decimals = decimals;
    entry.amount = decimals > 0 ? Number(entry.rawAmount) / 10 ** decimals : Number(entry.rawAmount);
  }

  return balanceMap;
}

export function mapTokenBalanceFromTokenProfiles(
  allBalancesByMint: BalanceMapByMint,
  tokenProfiles: TokenProfile[],
): BalanceMapByMint {
  const out: BalanceMapByMint = {} as BalanceMapByMint;
  for (const tokenProfile of tokenProfiles ?? []) {
    const mint = tokenProfile.address;
    out[mint] =
      allBalancesByMint[mint] ??
      ({
        mint,
        rawAmount: 0n,
        amount: 0,
        decimals: tokenProfile.decimals ?? 0,
        tokenAccounts: [],
      } satisfies SplBalance);
  }
  return out;
}