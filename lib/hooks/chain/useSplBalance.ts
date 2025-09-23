"use client";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TokenProfile, TokenSymbol } from "@/lib/config/tokens";

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

type SplBalance = {
  mint: string;
  rawAmount: bigint; // raw amount onchain
  amount: number; // simplified amount in human readable format
  decimals: number;
  tokenAccounts: string[]; // token account addresses used in the sum
};

export type BalanceMap = Record<TokenSymbol, SplBalance | undefined>;

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

      const resp = await connection.getParsedTokenAccountsByOwner(owner, {
        mint,
      });

      // Sum uiAmount across all token accounts for this mint
      let sum = 0;
      let rawAmount = BigInt(0);
      let decimals = 0;
      const tas: string[] = [];

      for (const { pubkey, account } of resp.value) {
        const info = (account.data.parsed as AccountDataParsed | undefined)
          ?.info;
        const amt = info?.tokenAmount;
        if (amt) {
          decimals = amt.decimals ?? decimals;
          rawAmount += BigInt(amt.amount);
          sum +=
            typeof amt.uiAmount === "number"
              ? amt.uiAmount
              : parseFloat(amt.uiAmountString ?? "0");
          tas.push(pubkey.toBase58());
        }
      }

      return {
        mint: mint.toBase58(),
        rawAmount,
        amount: sum,
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
  tokenProfiles: TokenProfile[],
): UseQueryResult<BalanceMap | undefined, Error> {
  return useQuery({
    queryKey: [
      "allSplBalances",
      owner?.toBase58(),
      tokenProfiles.map((t) => t.address).sort(),
    ],
    queryFn: async (): Promise<BalanceMap | undefined> => {
      if (!owner) return undefined;

      const resp = await connection.getParsedTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID,
      });

      // get each token balance
      const balanceMap: BalanceMap = {} as BalanceMap;
      for (const tokenProfile of tokenProfiles) {
        // find the token balance that matches the token profile
        const respValue = resp.value.find((c) => {
          const info = (c.account.data.parsed as AccountDataParsed | undefined)
            ?.info;
          const mintStr: string | undefined = info?.mint;

          return mintStr?.toLowerCase() === tokenProfile.address.toLowerCase();
        });

        // if there is match mint token address, add the balance to the map
        if (respValue) {
          const { pubkey, account } = respValue;
          const info = (account.data.parsed as AccountDataParsed).info;
          const tokenAmount = info.tokenAmount;

          const prev = balanceMap[tokenProfile.symbol] ?? {
            mint: info.mint,
            rawAmount: 0n,
            amount: 0,
            decimals: tokenAmount.decimals ?? 0,
            tokenAccounts: [] as string[],
          };

          const rawAmount = BigInt(tokenAmount.amount);
          const ui =
            typeof tokenAmount.uiAmount === "number"
              ? tokenAmount.uiAmount
              : parseFloat(tokenAmount.uiAmountString ?? "0");
          prev.rawAmount += rawAmount;
          prev.amount += ui;
          prev.decimals = tokenAmount.decimals ?? prev.decimals;
          prev.tokenAccounts.push(pubkey.toBase58());
          balanceMap[tokenProfile.symbol] = prev;
        } else {
          // use config from token profile
          balanceMap[tokenProfile.symbol] = {
            mint: tokenProfile.address,
            rawAmount: 0n,
            amount: 0,
            decimals: tokenProfile.decimal ?? 0,
            tokenAccounts: [] as string[],
          };
        }
      }

      return balanceMap;
    },
    enabled: !!owner,
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
