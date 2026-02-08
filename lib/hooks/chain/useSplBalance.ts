"use client";

import { unpackAccount, unpackMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TokenProfile, solana } from "@/lib/config/tokens";
import {
  getTokenAccountsByOwnerAllTokenProgramsRaw,
  mapTokenBalanceFromRawAccounts,
  mapTokenBalanceFromTokenProfiles,
} from "@/lib/utils/balance";
import { mintSummaryCache } from "@/lib/utils/storage";
import { BalanceMapByMint, SplBalance } from "./types";

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
      const cached = mintSummaryCache.get(mintStr);
      let decimals = cached?.decimals ?? 0;
      if (!cached) {
        const mintInfo = await connection.getAccountInfo(mint);
        if (mintInfo) {
          try {
            // Mint owner indicates which token program (legacy vs token-2022) to decode with.
            const m = unpackMint(mint, mintInfo, mintInfo.owner);
            decimals = m.decimals ?? 0;
            const supply = BigInt(m.supply.toString());
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

      return {
        mint: mintStr,
        rawAmount,
        amount:
          decimals > 0 ? Number(rawAmount) / 10 ** decimals : Number(rawAmount),
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
        excludeNftLike: true,
      });

      // Get NATIVE SOLANA balance
      const solanaBalanceAmount = await connection.getBalance(owner);
      const solanaBalanceObject: BalanceMapByMint = {
        [solana.address]: {
          mint: solana.address,
          rawAmount: BigInt(solanaBalanceAmount.toString()),
          amount: solanaBalanceAmount / 10 ** solana.decimals,
          decimals: solana.decimals,
          tokenAccounts: [],
        },
      };

      if (isMapFromAccount)
        return {
          ...byMint,
          ...solanaBalanceObject,
        };
      if (!tokenProfiles || tokenProfiles.length === 0) return undefined;
      return {
        ...mapTokenBalanceFromTokenProfiles(byMint, tokenProfiles),
        ...solanaBalanceObject,
      };
    },
    enabled: !!owner && (isMapFromAccount || (tokenProfiles?.length ?? 0) > 0),
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
