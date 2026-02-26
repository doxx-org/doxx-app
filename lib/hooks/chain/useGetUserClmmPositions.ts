import { Program } from "@coral-xyz/anchor";
import {
  PositionInfoLayout as PositionInfoLayoutFunction,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { Connection, PublicKey } from "@solana/web3.js";
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
import {
  PositionFees,
  PositionInfoLayout,
  PositionRewardInfo,
  UserPositionWithNFT,
} from "./types";

/**
 * Fetch positions with error handling for corrupted accounts
 */
async function getOwnerPositionsSafe(params: {
  connection: Connection;
  wallet: PublicKey;
  programId: PublicKey;
}): Promise<PositionInfoLayout[]> {
  const { connection, wallet, programId } = params;

  try {
    // Step 1: Get all NFT token accounts owned by wallet
    const tokenAccounts = await getTokenAccountsByOwnerAllTokenProgramsRaw(
      connection,
      wallet,
      true,
    );

    const byMint = await mapTokenBalanceFromRawAccounts(
      connection,
      tokenAccounts,
      {
        includeTokenAccounts: true,
        skipZeroBalances: true,
        excludeNftLike: false,
        onlyNftLike: true,
      },
    );
    console.log("🚀 ~ byMint:", byMint);

    console.log(`Found ${tokenAccounts.value.length} token accounts`);

    // Step 2: Filter for position NFTs (amount = 1, decimals = 0)
    const nftAccounts = Object.values(byMint)
      .filter((account) => {
        if (!account) return false;
        return account.decimals === 0 && account.amount === 1;
      })
      .filter((account) => account !== undefined)
      .map((account) => new PublicKey(account.mint));

    console.log(`Found ${nftAccounts.length} potential position NFTs`);

    // Step 3: For each NFT, try to get the position account
    const positions: PositionInfoLayout[] = [];

    for (const nftAccount of nftAccounts) {
      try {
        const nftMint = new PublicKey(nftAccount);

        // Derive position PDA
        const [positionPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("position"), nftMint.toBuffer()],
          programId,
        );

        // Try to fetch position account
        const positionAccountInfo =
          await connection.getAccountInfo(positionPda);

        if (!positionAccountInfo) {
          console.warn(
            `Position account not found for NFT ${nftMint.toString()}`,
          );
          continue;
        }

        // Decode position (you need the position layout)
        // For now, just check if it exists
        const positionData = decodePositionAccount(positionAccountInfo.data);

        positions.push({
          // nftMint,
          // positionPda,
          ...positionData,
        });

        console.log(`✅ Valid position: ${nftMint.toString()}`);
      } catch (error) {
        console.warn(`⚠️ Skipping corrupted position:`, error);
        // Skip this position and continue
        continue;
      }
    }

    return positions;
  } catch (error) {
    console.error("Error fetching positions:", error);
    throw error;
  }
}

/**
 * Decode position account data
 * You'll need the proper layout for your CLMM program
 */
function decodePositionAccount(data: Buffer): PositionInfoLayout {
  // This is a placeholder - use your actual PositionInfoLayout
  // from @/lib/hooks/chain/types or similar

  try {
    // Example using borsh or similar
    const position = PositionInfoLayoutFunction.decode(data);
    return position;
  } catch (error) {
    throw new Error(`Failed to decode position: ${error}`);
  }
}

async function getOwnerPositionsWithFallback(params: {
  raydium: Raydium;
  programId: PublicKey;
  wallet: PublicKey;
}): Promise<PositionInfoLayout[]> {
  const { raydium, programId, wallet } = params;

  try {
    // Try SDK method first
    const positions = await raydium.clmm.getOwnerPositionInfo({
      programId: programId.toString(),
    });
    return positions;
  } catch (error) {
    console.error("SDK getOwnerPositionInfo failed:", error);
    console.log("Falling back to manual position fetching...");

    // Fallback to manual fetching
    return getOwnerPositionsSafe({
      connection: raydium.connection,
      wallet,
      programId,
    });
  }

  // // On Solayer we want to avoid Raydium's internal token-account scanning,
  // // which can throw RangeError and/or silently return no positions.
  // // Use the manual, layout-based fetch as the primary source of truth.
  // try {
  //   const manualPositions = await getOwnerPositionsSafe({
  //     connection: raydium.connection,
  //     wallet,
  //     programId,
  //   });
  //   return manualPositions;
  // } catch (error) {
  //   console.error("Manual getOwnerPositionsSafe failed:", error);

  //   // As a very last resort, try the SDK helper, but don't rely on it.
  //   try {
  //     const sdkPositions = await raydium.clmm.getOwnerPositionInfo({
  //       programId: programId.toString(),
  //     });
  //     return sdkPositions;
  //   } catch (sdkError) {
  //     console.error("SDK getOwnerPositionInfo also failed:", sdkError);
  //     return [];
  //   }
  // }
}

export function useGetUserClmmPositions(
  raydium: Raydium | undefined,
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

      if (
        !program ||
        !userWallet ||
        !clmmPools ||
        clmmPools.length === 0 ||
        !raydium
      )
        return undefined;

      const connection = raydium.connection;

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
      const raydiumPositions: PositionInfoLayout[] =
        await getOwnerPositionsWithFallback({
          raydium,
          programId: program.programId,
          wallet: userWallet,
        });

      // const positions = await program.account.personalPositionState.all();
      const nftMintsSet = new Set(nftMints.map((mint) => mint.toBase58()));

      const userPositions = raydiumPositions.filter((pos) =>
        nftMintsSet.has(pos.nftMint.toBase58()),
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
        new Set(userPositions.map((p) => p.poolId.toBase58())),
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
          const pool = poolStateMap.get(pos.poolId.toBase58());
          const clmmPoolState = pool?.clmmPoolState;
          if (!pool || !clmmPoolState || clmmPoolState === undefined)
            return undefined;
          const nftAccount = nftAccounts.find(
            (acc) => acc.mint === pos.nftMint.toBase58(),
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
            pos.liquidity,
            pos.tickLower,
            pos.tickUpper,
            clmmPoolState.sqrtPriceX64, // Current tick from pool state
            mintDecimals0,
            mintDecimals1,
          );

          const positionRewardInfos: PositionRewardInfo[] =
            pos.rewardInfos.reduce((acc, cur, index) => {
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
            normalizeBN(pos.tokenFeesOwedA, mintDecimals0),
          );
          const fees1Amount = Number(
            normalizeBN(pos.tokenFeesOwedB, mintDecimals1),
          );
          const fees0ValueUsd = fees0Amount * token0Price;
          const fees1ValueUsd = fees1Amount * token1Price;
          const fees: PositionFees = {
            token0: {
              amount: fees0Amount,
              valueUsd: fees0ValueUsd,
              amountRaw: pos.tokenFeesOwedA,
              mint: token0Mint,
              decimals: mintDecimals0,
              tokenProfile: tokenMap[token0Mint.toBase58()] ?? undefined,
            },
            token1: {
              amount: fees1Amount,
              valueUsd: fees1ValueUsd,
              amountRaw: pos.tokenFeesOwedB,
              mint: token1Mint,
              decimals: mintDecimals1,
              tokenProfile: tokenMap[token1Mint.toBase58()] ?? undefined,
            },
          };

          return {
            positionLayout: pos,
            nftTokenAccount: new PublicKey(nftAccount?.tokenAccounts[0] ?? 0),
            poolId: pos.poolId,
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
    enabled:
      !!program &&
      !!userWallet &&
      !!allPools &&
      allPools.length > 0 &&
      !!raydium,
    staleTime: 2 * 60 * 1000, // 2 minutes - token balances don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
