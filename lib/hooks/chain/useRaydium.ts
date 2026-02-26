import {
  Raydium,
  TokenAccount,
  TokenAccountRaw,
} from "@raydium-io/raydium-sdk-v2";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import BN from "bn.js";
import { clientEnvConfig } from "@/lib/config/envConfig";
import { getTokenAccountsByOwnerAllTokenProgramsRaw } from "@/lib/utils/balance";

export function useRaydium({
  connection,
  wallet,
}: {
  connection: Connection | undefined;
  wallet: AnchorWallet | undefined;
}): UseQueryResult<Raydium | undefined, Error> {
  return useQuery({
    queryKey: [
      "raydium",
      connection?.rpcEndpoint,
      wallet?.publicKey?.toBase58(),
    ],
    queryFn: async () => {
      if (!connection) {
        return undefined;
      }

      // Preload token accounts using our Solayer-safe decoder, then inject
      // them into Raydium so it never has to parse token accounts itself.
      const tokenAccounts: TokenAccount[] = [];
      const tokenAccountRawInfos: TokenAccountRaw[] = [];

      if (wallet?.publicKey) {
        const rawResp = await getTokenAccountsByOwnerAllTokenProgramsRaw(
          connection,
          wallet.publicKey,
          true,
        );

        for (const { pubkey, account, programId } of rawResp.value) {
          const effectiveProgramId =
            account.owner.equals(TOKEN_PROGRAM_ID) ||
            account.owner.equals(TOKEN_2022_PROGRAM_ID)
              ? account.owner
              : programId;

          if (
            !effectiveProgramId.equals(TOKEN_PROGRAM_ID) &&
            !effectiveProgramId.equals(TOKEN_2022_PROGRAM_ID)
          ) {
            continue;
          }
          if (!account.owner.equals(effectiveProgramId)) continue;

          let decoded;
          try {
            decoded = unpackAccount(pubkey, account, effectiveProgramId);
          } catch {
            // Skip non-token or malformed accounts
            continue;
          }

          const amountBn = new BN(decoded.amount.toString());

          tokenAccounts.push({
            publicKey: pubkey,
            mint: decoded.mint,
            amount: amountBn,
            isNative: false,
            isAssociated: false,
            programId: effectiveProgramId,
          });

          // Raydium really only uses mint + amount here; other fields are unused
          tokenAccountRawInfos.push({
            programId: effectiveProgramId,
            pubkey,
            accountInfo: {
              mint: decoded.mint,
              owner: decoded.owner,
              amount: amountBn,
              // Minimal stub for unused fields
              delegateOption: 0,
              delegate: PublicKey.default,
              state: 1,
              isNativeOption: 0,
              isNative: new BN(0),
              delegatedAmount: new BN(0),
              closeAuthorityOption: 0,
              closeAuthority: PublicKey.default,
            },
          });
        }
      }

      const raydium = await Raydium.load({
        connection: connection,
        urlConfigs: {
          RPCS: clientEnvConfig.NEXT_PUBLIC_RPC_URL,
        },
        owner: wallet?.publicKey,
        signAllTransactions: wallet?.signAllTransactions,
        tokenAccounts,
        tokenAccountRawInfos,
      });

      // Hard override: never let Raydium refetch wallet token accounts.
      // This avoids the broken decode path entirely.
      raydium.account.fetchWalletTokenAccounts = async () => {
        return {
          tokenAccounts: raydium.account.tokenAccounts ?? [],
          tokenAccountRawInfos: raydium.account.tokenAccountRawInfos ?? [],
        };
      };

      return raydium;
    },
    enabled: !!connection,
  });
}
