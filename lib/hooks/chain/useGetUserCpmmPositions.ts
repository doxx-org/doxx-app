import { Raydium } from "@doxxorg/cpmm-sdk";
import { PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import BN from "bn.js";
import Decimal from "decimal.js";
import { Pool, PoolType } from "@/components/earn/v2/types";
import { TokenProfile } from "@/lib/config/tokens";
import {
  getTokenAccountsByOwnerAllTokenProgramsRaw,
  mapTokenBalanceFromRawAccounts,
} from "@/lib/utils/balance";
import { PositionFees, UserCPMMPosition } from "./types";

export type { UserCPMMPosition };

function buildZeroFee(
  mint: PublicKey,
  decimals: number,
  tokenProfile: TokenProfile | undefined,
) {
  return {
    amount: 0,
    valueUsd: 0,
    amountRaw: new BN(0),
    mint,
    decimals,
    tokenProfile,
  };
}

function buildFeeEntry(
  rawAmount: BN,
  decimals: number,
  price: number,
  mint: PublicKey,
  tokenProfile: TokenProfile | undefined,
) {
  const amount = new Decimal(rawAmount.toString())
    .div(new Decimal(10).pow(decimals))
    .toNumber();
  return {
    amount,
    valueUsd: amount * price,
    amountRaw: rawAmount,
    mint,
    decimals,
    tokenProfile,
  };
}

export function useGetUserCPMMPositions(
  raydium: Raydium | undefined,
  userWallet: PublicKey | undefined,
  allPools: Pool[] | undefined,
): UseQueryResult<UserCPMMPosition[] | undefined, Error> {
  return useQuery({
    queryKey: ["userCPMMPositions", userWallet?.toString()],
    queryFn: async (): Promise<UserCPMMPosition[] | undefined> => {
      const cpmmPools = allPools?.filter(
        (p) => p.poolType === PoolType.CPMM && p.cpmmPoolState !== undefined,
      );

      if (!userWallet || !cpmmPools || cpmmPools.length === 0 || !raydium)
        return [];

      const connection = raydium.connection;

      const rawAccounts = await getTokenAccountsByOwnerAllTokenProgramsRaw(
        connection,
        userWallet,
        true,
      );

      const byMint = await mapTokenBalanceFromRawAccounts(
        connection,
        rawAccounts,
        {
          includeTokenAccounts: true,
          skipZeroBalances: true,
          excludeNftLike: false,
          onlyNftLike: false,
        },
      );

      // Find pools where the user holds LP tokens
      const matchedPools: { pool: Pool; lpMintStr: string }[] = [];
      for (const pool of cpmmPools) {
        const lpMintStr = pool.cpmmPoolState?.lpMint.toBase58();
        if (!lpMintStr) continue;
        if (byMint[lpMintStr]) {
          matchedPools.push({ pool, lpMintStr });
        }
      }

      if (matchedPools.length === 0) return [];

      // Fetch fresh RPC pool data for all matched pools in one batch call
      const poolIds = matchedPools.map((m) => m.pool.poolId);
      const rpcDataMap = await raydium.cpmm.getRpcPoolInfos(poolIds, false);

      const positions: UserCPMMPosition[] = [];

      for (const { pool, lpMintStr } of matchedPools) {
        try {
          const lpBalance = byMint[lpMintStr];
          if (!lpBalance) continue;

          const rpcData = rpcDataMap[pool.poolId];
          if (!rpcData) {
            console.warn(`No RPC data found for pool ${pool.poolId}`);
            continue;
          }

          const lpAmountRaw = new BN(lpBalance.rawAmount.toString());
          const lpDecimals = lpBalance.decimals;
          const totalLpRaw = rpcData.lpAmount;

          if (totalLpRaw.isZero()) continue;

          // user share = userLp / totalLp
          const userShare = new Decimal(lpAmountRaw.toString()).div(
            new Decimal(totalLpRaw.toString()),
          );

          // Token amounts from the net reserves (LP holder portion)
          const amount0Raw = new BN(
            userShare
              .mul(new Decimal(rpcData.baseReserve.toString()))
              .toFixed(0, Decimal.ROUND_DOWN),
          );
          const amount1Raw = new BN(
            userShare
              .mul(new Decimal(rpcData.quoteReserve.toString()))
              .toFixed(0, Decimal.ROUND_DOWN),
          );

          const mintDecimalA = rpcData.mintDecimalA;
          const mintDecimalB = rpcData.mintDecimalB;

          const amount0 = new Decimal(amount0Raw.toString())
            .div(new Decimal(10).pow(mintDecimalA))
            .toNumber();
          const amount1 = new Decimal(amount1Raw.toString())
            .div(new Decimal(10).pow(mintDecimalB))
            .toNumber();

          const lpTokenAccount = new PublicKey(
            lpBalance.tokenAccounts[0] ?? PublicKey.default,
          );

          const token0Mint = rpcData.mintA;
          const token1Mint = rpcData.mintB;
          const token0Profile = pool.lpToken.token1 as TokenProfile | undefined;
          const token1Profile = pool.lpToken.token2 as TokenProfile | undefined;

          const token0Price = pool.oraclePriceToken1Usd ?? pool.priceToken1Usd;
          const token1Price = pool.oraclePriceToken2Usd ?? pool.priceToken2Usd;

          // In CPMM, LP trading fees accumulate directly into the reserves
          // (baseReserve / quoteReserve grow as fees accrue), so there is no
          // separately claimable amount per LP position.
          //
          // However, the pool vaults also hold uncollected protocol / fund /
          // creator fees that have NOT yet been swept out.  We surface the
          // user's pro-rata share of those as a fee signal.
          //
          //   vaultAAmount = baseReserve + protocolFeesMintA
          //                             + fundFeesMintA
          //                             + creatorFeesMintA
          //
          // The delta (vaultAAmount - baseReserve) = sum of those fees.
          // We scale it by userShare to get the user's attributable portion.
          const vaultFeeRawA = rpcData.vaultAAmount
            .sub(rpcData.baseReserve)
            .sub(rpcData.quoteReserve.mul(new BN(0))); // keep as token A
          const vaultFeeRawB = rpcData.vaultBAmount.sub(rpcData.quoteReserve);

          const feeAmountARaw = new BN(
            userShare
              .mul(new Decimal(vaultFeeRawA.toString()))
              .toFixed(0, Decimal.ROUND_DOWN),
          );
          const feeAmountBRaw = new BN(
            userShare
              .mul(new Decimal(vaultFeeRawB.toString()))
              .toFixed(0, Decimal.ROUND_DOWN),
          );

          const fees: PositionFees = {
            token0: feeAmountARaw.gtn(0)
              ? buildFeeEntry(
                  feeAmountARaw,
                  mintDecimalA,
                  token0Price,
                  token0Mint,
                  token0Profile,
                )
              : buildZeroFee(token0Mint, mintDecimalA, token0Profile),
            token1: feeAmountBRaw.gtn(0)
              ? buildFeeEntry(
                  feeAmountBRaw,
                  mintDecimalB,
                  token1Price,
                  token1Mint,
                  token1Profile,
                )
              : buildZeroFee(token1Mint, mintDecimalB, token1Profile),
          };

          positions.push({
            poolId: new PublicKey(pool.poolId),
            pool,
            rpcData,
            lpMint: new PublicKey(lpMintStr),
            lpTokenAccount,
            lpAmountRaw,
            lpDecimals,
            userShare: userShare.toNumber(),
            amount0,
            amount1,
            amount0Raw,
            amount1Raw,
            fees,
            rewardInfos: [],
          });
        } catch (err) {
          console.warn(
            `Failed to compute position for pool ${pool.poolId}:`,
            err,
          );
        }
      }

      return positions;
    },
    enabled: !!userWallet && !!allPools && allPools.length > 0 && !!raydium,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
