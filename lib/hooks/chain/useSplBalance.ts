"use client";

import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";
import {
  AccountInfo,
  Connection,
  ParsedAccountData,
  PublicKey,
  RpcResponseAndContext,
} from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, SplBalance } from "./types";

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

// Perf caches (module-level, survives hook re-renders)
// - Mint decimals never change; cache them to avoid re-fetching on every refetch.
const mintDecimalsCache = new Map<string, number>();

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type MapFromAccountOptions = {
  includeTokenAccounts?: boolean;
  skipZeroBalances?: boolean;
};

// Fetch balance for a single mint
export function useSplBalanceByMint(
  connection: Connection,
  owner: PublicKey | undefined,
  mint: PublicKey | undefined,
): UseQueryResult<SplBalance | undefined, Error> {
  return useQuery({
    queryKey: ["splBalance", owner?.toBase58(), mint?.toBase58()],
    queryFn: async (): Promise<SplBalance | undefined> => {
      if (!owner || !mint) return undefined;

      // Solayer: use raw decoding (jsonParsed is not supported).
      const rawResp = await connection.getTokenAccountsByOwner(owner, { mint });

      let rawAmount = 0n;
      const tas: string[] = [];
      for (const { pubkey, account } of rawResp.value) {
        const ta = unpackAccount(pubkey, account, account.owner);
        rawAmount += BigInt(ta.amount.toString());
        tas.push(pubkey.toBase58());
      }

      const mintStr = mint.toBase58();
      const cachedDecimals = mintDecimalsCache.get(mintStr);
      let decimals = cachedDecimals ?? 0;
      if (cachedDecimals === undefined) {
        const mintInfo = await connection.getAccountInfo(mint);
        if (mintInfo) {
          try {
            // Mint owner indicates which token program (legacy vs token-2022) to decode with.
            const m = unpackMint(mint, mintInfo, mintInfo.owner);
            decimals = m.decimals ?? 0;
            mintDecimalsCache.set(mintStr, decimals);
          } catch {
            // ignore
          }
        }
      }

      return {
        mint: mintStr,
        rawAmount,
        amount: decimals > 0 ? Number(rawAmount) / 10 ** decimals : Number(rawAmount),
        decimals,
        tokenAccounts: tas,
      };
    },
    enabled: !!(owner && mint),
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

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

  const balanceMap: BalanceMapByMint = {} as BalanceMapByMint;
  for (const { pubkey, account } of resp.value) {
    const info = (account.data.parsed as AccountDataParsed).info;
    const tokenAmount = info.tokenAmount;

    const rawAmount = BigInt(tokenAmount.amount);
    if (skipZeroBalances && rawAmount === 0n) continue;

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

async function getTokenAccountsByOwnerAllTokenProgramsRaw(
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

async function mapTokenBalanceFromRawAccounts(
  connection: Connection,
  rawResp: RpcResponseAndContext<RawTokenAccountByOwner[]>,
  options?: MapFromAccountOptions,
): Promise<BalanceMapByMint> {
  const includeTokenAccounts = options?.includeTokenAccounts ?? false;
  const skipZeroBalances = options?.skipZeroBalances ?? true;

  const balanceMap: BalanceMapByMint = {} as BalanceMapByMint;
  const programIdByMint = new Map<string, PublicKey>();

  // 1) Aggregate raw token amounts by mint
  for (const { pubkey, account, programId } of rawResp.value) {
    const ta = unpackAccount(pubkey, account, programId);
    if (skipZeroBalances && ta.amount === 0n) continue;
    const mintStr = ta.mint.toBase58();
    programIdByMint.set(mintStr, programId);

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

  // 2) Fill decimals from cache; only fetch missing mint infos
  const missingMintStrs = [...programIdByMint.keys()].filter(
    (mintStr) => mintDecimalsCache.get(mintStr) === undefined,
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
        mintDecimalsCache.set(mintStr, decimals);
      } catch {
        // ignore
      }
    }
  }

  // 3) Compute UI amounts using cached decimals
  for (const mintStr of programIdByMint.keys()) {
    const entry = balanceMap[mintStr];
    if (!entry) continue;
    const decimals = mintDecimalsCache.get(mintStr) ?? 0;
    entry.decimals = decimals;
    entry.amount = decimals > 0 ? Number(entry.rawAmount) / 10 ** decimals : Number(entry.rawAmount);
  }

  return balanceMap;
}

function mapTokenBalanceFromTokenProfiles(
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

// List *all* token balances (jsonParsed over the Token Program)
export function useAllSplBalances(
  connection: Connection,
  owner: PublicKey | undefined,
  tokenProfiles: TokenProfile[] | undefined,
  isMapFromAccount: boolean = false,
  options?: {
    includeToken2022?: boolean;
    includeTokenAccounts?: boolean;
  },
): UseQueryResult<BalanceMapByMint | undefined, Error> {
  return useQuery({
    queryKey: [
      "allSplBalances",
      owner?.toBase58(),
      tokenProfiles?.map((t) => t.address).sort(),
      isMapFromAccount,
      options?.includeToken2022 ?? true,
      options?.includeTokenAccounts ?? false,
    ],
    queryFn: async (): Promise<BalanceMapByMint | undefined> => {
      if (!owner) return undefined;

      // Solayer: use raw decoding (jsonParsed is not supported).
      const includeToken2022 = options?.includeToken2022 ?? true;
      const includeTokenAccounts = options?.includeTokenAccounts ?? false;

      const rawResp = await getTokenAccountsByOwnerAllTokenProgramsRaw(
        connection,
        owner,
        includeToken2022,
      );
      const byMint = await mapTokenBalanceFromRawAccounts(connection, rawResp, {
        includeTokenAccounts,
        skipZeroBalances: true,
      });

      if (isMapFromAccount) return byMint;
      if (!tokenProfiles || tokenProfiles.length === 0) return undefined;
      return mapTokenBalanceFromTokenProfiles(byMint, tokenProfiles);
    },
    enabled: !!owner && (isMapFromAccount || (tokenProfiles?.length ?? 0) > 0),
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
