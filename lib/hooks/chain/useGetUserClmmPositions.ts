import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { Pool, PoolType } from "@/components/earn/v2/types";
import { TokenProfile } from "@/lib/config/tokens";
import { DoxxClmmIdl } from "@/lib/idl";
import { normalizeBN } from "@/lib/utils";
import {
  getTokenAccountsByOwnerAllTokenProgramsRaw,
  mapTokenBalanceFromRawAccounts,
} from "@/lib/utils/balance";
import { getTokenAmountsFromLiquidity } from "@/lib/utils/calculation";
import { CLMMPersonalPositionState, CLMMPoolState } from "./types";

export interface PersonalPositionState {
  publicKey: PublicKey;
  account: CLMMPersonalPositionState;
}

export interface PositionRewardInfo {
  rewardTokenProfile: TokenProfile | undefined;
  rewardMint: PublicKey;
  rewardDecimals: number;
  pendingAmount: number;
  pendingAmountRaw: BN;
  pendingValueUsd: number | undefined;
}

interface PositionFee {
  amount: number;
  valueUsd: number;
  amountRaw: BN;
  mint: PublicKey;
  decimals: number;
  tokenProfile: TokenProfile | undefined;
}

export interface PositionFees {
  token0: PositionFee;
  token1: PositionFee;
}

export interface UserPositionWithNFT extends PersonalPositionState {
  nftTokenAccount: PublicKey;
  poolId: PublicKey;
  pool: CLMMPoolState; // Pool state
  amount0: number;
  amount1: number;
  fees: PositionFees;
  rewardInfos: PositionRewardInfo[];
}

export function useGetUserClmmPositions(
  program: Program<DoxxClmmIdl> | undefined,
  userWallet: PublicKey | undefined,
  allPools: Pool[] | undefined,
): UseQueryResult<UserPositionWithNFT[] | undefined, Error> {
  return useQuery({
    queryKey: ["userPositionsWithPools", userWallet?.toString()],
    queryFn: async (): Promise<UserPositionWithNFT[] | undefined> => {
      const clmmPools = allPools
        ?.filter((p) => p.poolType === PoolType.CLMM)
        .filter((p) => p.clmmPoolState !== undefined);

      if (!program || !userWallet || !clmmPools || clmmPools.length === 0)
        return undefined;

      const connection = program.provider.connection;

      // Get user's NFT token accounts
      const userTokenAccounts =
        await getTokenAccountsByOwnerAllTokenProgramsRaw(
          connection,
          userWallet,
          true,
        );

      const byMint = await mapTokenBalanceFromRawAccounts(
        connection,
        userTokenAccounts,
        {
          includeTokenAccounts: true,
          skipZeroBalances: true,
          excludeNftLike: false,
          onlyNftLike: true,
        },
      );

      const nftAccounts = Object.values(byMint).filter(
        (acc) => acc !== undefined,
      );
      if (nftAccounts.length === 0) return [];

      const nftMints = nftAccounts.map((acc) => new PublicKey(acc.mint));

      // Get all positions
      const positions = await program.account.personalPositionState.all();
      const nftMintsSet = new Set(nftMints.map((mint) => mint.toBase58()));

      const userPositions = positions.filter((pos) =>
        nftMintsSet.has(pos.account.nftMint.toBase58()),
      );

      const tokenMap = clmmPools.reduce(
        (acc, c) => {
          if (!acc[c.lpToken.token1.address]) {
            acc[c.lpToken.token1.address] = c.lpToken.token1;
          }
          if (!acc[c.lpToken.token2.address]) {
            acc[c.lpToken.token2.address] = c.lpToken.token2;
          }
          return acc;
        },
        {} as Partial<Record<string, TokenProfile>>,
      );

      // Get unique pool IDs
      const uniquePoolIds = Array.from(
        new Set(userPositions.map((p) => p.account.poolId.toBase58())),
      ).map((id) => new PublicKey(id));

      const poolStateMap = new Map(
        uniquePoolIds.map((id) => [
          id.toBase58(),
          clmmPools.find(
            (p) => p.poolId.toLowerCase() === id.toBase58().toLowerCase(),
          ),
        ]),
      );

      // Combine data
      const positionsWithPools: UserPositionWithNFT[] = userPositions
        .map((pos) => {
          const pool = poolStateMap.get(pos.account.poolId.toBase58());
          const clmmPoolState = pool?.clmmPoolState;
          if (!pool || !clmmPoolState || clmmPoolState === undefined)
            return undefined;
          const nftAccount = nftAccounts.find(
            (acc) => acc.mint === pos.account.nftMint.toBase58(),
          );

          const token0Mint = new PublicKey(pool.lpToken.token1.address);
          const token1Mint = new PublicKey(pool.lpToken.token2.address);
          const mintDecimals0 = pool.lpToken.token1.decimals;
          const mintDecimals1 = pool.lpToken.token2.decimals;
          const token0Price = pool.oraclePriceToken1Usd
            ? pool.oraclePriceToken1Usd
            : pool.priceToken1Usd;
          const token1Price = pool.oraclePriceToken2Usd
            ? pool.oraclePriceToken2Usd
            : pool.priceToken2Usd;

          // Calculate token amounts from liquidity
          const { amount0, amount1 } = getTokenAmountsFromLiquidity(
            pos.account.liquidity,
            pos.account.tickLowerIndex,
            pos.account.tickUpperIndex,
            clmmPoolState.sqrtPriceX64, // Current tick from pool state
            mintDecimals0,
            mintDecimals1,
          );

          const positionRewardInfos: PositionRewardInfo[] =
            pos.account.rewardInfos.reduce((acc, cur, index) => {
              const rewardToken = clmmPoolState.rewardInfos[index];
              if (
                !rewardToken ||
                rewardToken.tokenMint.equals(PublicKey.default)
              )
                return acc;

              const rewardAmountRaw = cur.rewardAmountOwed;
              const rewardTokenProfile =
                tokenMap[rewardToken.tokenMint.toBase58()];
              const pendingAmount = Number(
                normalizeBN(rewardAmountRaw, rewardTokenProfile?.decimals ?? 9),
              );

              acc.push({
                rewardTokenProfile,
                rewardMint: rewardToken.tokenMint,
                rewardDecimals: rewardTokenProfile?.decimals ?? 9,
                pendingAmount,
                pendingAmountRaw: rewardAmountRaw,
                // TODO: Calculate pending value USD
                pendingValueUsd: undefined,
              });

              return acc;
            }, [] as PositionRewardInfo[]);

          // Trading fees (token0 and token1)
          const fees0Amount = Number(
            normalizeBN(pos.account.tokenFeesOwed0, mintDecimals0),
          );
          const fees1Amount = Number(
            normalizeBN(pos.account.tokenFeesOwed1, mintDecimals1),
          );
          const fees0ValueUsd = fees0Amount * token0Price;
          const fees1ValueUsd = fees1Amount * token1Price;
          const fees: PositionFees = {
            token0: {
              amount: fees0Amount,
              valueUsd: fees0ValueUsd,
              amountRaw: pos.account.tokenFeesOwed0,
              mint: token0Mint,
              decimals: mintDecimals0,
              tokenProfile: tokenMap[token0Mint.toBase58()] ?? undefined,
            },
            token1: {
              amount: fees1Amount,
              valueUsd: fees1ValueUsd,
              amountRaw: pos.account.tokenFeesOwed1,
              mint: token1Mint,
              decimals: mintDecimals1,
              tokenProfile: tokenMap[token1Mint.toBase58()] ?? undefined,
            },
          };

          return {
            ...pos,
            nftTokenAccount: new PublicKey(nftAccount?.tokenAccounts[0] ?? 0),
            poolId: pos.account.poolId,
            pool: clmmPoolState,
            amount0,
            amount1,
            fees,
            rewardInfos: positionRewardInfos,
          };
        })
        .filter((p) => p !== undefined);

      return positionsWithPools;
    },
    enabled: !!program && !!userWallet && !!allPools && allPools.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
