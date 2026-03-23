import { useCallback, useState } from "react";
import {
  Raydium,
  TxVersion,
  ClmmInstrument,
  ClmmKeys,
  ClmmPositionLayout,
  ApiV3PoolInfoConcentratedItem,
  getATAAddress,
  getMultipleAccountsInfoWithCustomFlags,
  WSOLMint,
} from "@raydium-io/raydium-sdk-v2";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { IPositionWithValue, RawPoolInfo } from "./types";

interface HarvestAllParams {
  positions: IPositionWithValue[];
  poolInfos: Record<string, RawPoolInfo>;
}

/**
 * Custom harvestAllRewards that accepts poolKeys directly instead of
 * fetching them from Raydium's API (which fails for custom Doxx pools).
 *
 * Based on Raydium SDK's clmm.harvestAllRewards but with:
 * - poolKeys from RPC data instead of API
 * - No lock position support (not needed for Doxx)
 */
async function buildHarvestAllRewardsTx(
  raydium: Raydium,
  allPoolInfo: Record<string, ApiV3PoolInfoConcentratedItem>,
  allPositions: Record<string, ClmmPositionLayout[]>,
  allPoolKeys: Record<string, ClmmKeys>,
  feePayer: PublicKey,
  computeBudgetConfig?: { units: number; microLamports: number },
) {
  const ownerMintToAccount: Record<string, PublicKey> = {};

  // Build owner token account map from wallet's existing accounts
  await raydium.account.fetchWalletTokenAccounts();
  for (const item of raydium.account.tokenAccountRawInfos) {
    const ata = getATAAddress(
      raydium.ownerPubKey,
      item.accountInfo.mint,
    ).publicKey;
    if (ata.equals(item.pubkey)) {
      ownerMintToAccount[item.accountInfo.mint.toString()] = item.pubkey;
    }
  }

  // Check NFT mint owners for Token-2022 detection
  const allNftMints = Object.values(allPositions)
    .flat()
    .map((p) => p.nftMint);

  const mintData = await getMultipleAccountsInfoWithCustomFlags(
    raydium.connection,
    allNftMints.map((n) => ({ pubkey: n })),
  );
  const nftOwnerRecord: Record<string, PublicKey | null> = {};
  mintData.forEach((data) => {
    nftOwnerRecord[data.pubkey.toBase58()] =
      data?.accountInfo?.owner ?? null;
  });

  // Use Raydium's internal tx builder
  // @ts-expect-error — accessing internal createTxBuilder
  const txBuilder = raydium.clmm.createTxBuilder(feePayer);

  for (const itemInfo of Object.values(allPoolInfo)) {
    if (allPositions[itemInfo.id] === undefined) continue;

    // Skip pools with no harvestable positions
    if (
      !allPositions[itemInfo.id].find(
        (i) =>
          !i.liquidity.isZero() ||
          (i.rewardInfos &&
            i.rewardInfos.find((ii) => !ii.rewardAmountOwed.isZero())),
      )
    )
      continue;

    const poolInfo = itemInfo;
    const poolKeys = allPoolKeys[itemInfo.id];
    if (!poolKeys) continue;

    const mintAUseSOLBalance =
      poolInfo.mintA.address === WSOLMint.toString();
    const mintBUseSOLBalance =
      poolInfo.mintB.address === WSOLMint.toString();

    // Resolve token account A
    let ownerTokenAccountA = ownerMintToAccount[poolInfo.mintA.address];
    if (!ownerTokenAccountA) {
      if (mintAUseSOLBalance) {
        const { account, instructionParams } =
          await raydium.account.getOrCreateTokenAccount({
            tokenProgram: poolInfo.mintA.programId,
            mint: new PublicKey(poolInfo.mintA.address),
            notUseTokenAccount: true,
            owner: raydium.ownerPubKey,
            skipCloseAccount: false,
            createInfo: { payer: feePayer, amount: 0 },
            associatedOnly: false,
            checkCreateATAOwner: false,
          });
        ownerTokenAccountA = account!;
        instructionParams && txBuilder.addInstruction(instructionParams);
      } else {
        const mint = new PublicKey(poolInfo.mintA.address);
        ownerTokenAccountA = raydium.account.getAssociatedTokenAccount(
          mint,
          new PublicKey(poolInfo.mintA.programId),
        );
        txBuilder.addInstruction({
          instructions: [
            createAssociatedTokenAccountIdempotentInstruction(
              raydium.ownerPubKey,
              ownerTokenAccountA,
              raydium.ownerPubKey,
              mint,
              new PublicKey(poolInfo.mintA.programId),
            ),
          ],
        });
      }
    }

    // Resolve token account B
    let ownerTokenAccountB = ownerMintToAccount[poolInfo.mintB.address];
    if (!ownerTokenAccountB) {
      if (mintBUseSOLBalance) {
        const { account, instructionParams } =
          await raydium.account.getOrCreateTokenAccount({
            tokenProgram: poolInfo.mintB.programId,
            mint: new PublicKey(poolInfo.mintB.address),
            notUseTokenAccount: true,
            owner: raydium.ownerPubKey,
            skipCloseAccount: false,
            createInfo: { payer: feePayer, amount: 0 },
            associatedOnly: false,
            checkCreateATAOwner: false,
          });
        ownerTokenAccountB = account!;
        instructionParams && txBuilder.addInstruction(instructionParams);
      } else {
        const mint = new PublicKey(poolInfo.mintB.address);
        ownerTokenAccountB = raydium.account.getAssociatedTokenAccount(
          mint,
          new PublicKey(poolInfo.mintB.programId),
        );
        txBuilder.addInstruction({
          instructions: [
            createAssociatedTokenAccountIdempotentInstruction(
              raydium.ownerPubKey,
              ownerTokenAccountB,
              raydium.ownerPubKey,
              mint,
              new PublicKey(poolInfo.mintB.programId),
            ),
          ],
        });
      }
    }

    ownerMintToAccount[poolInfo.mintA.address] = ownerTokenAccountA;
    ownerMintToAccount[poolInfo.mintB.address] = ownerTokenAccountB;

    // Resolve reward accounts
    const rewardAccounts: PublicKey[] = [];
    for (const itemReward of poolInfo.rewardDefaultInfos) {
      const rewardUseSOLBalance =
        itemReward.mint.address === WSOLMint.toString();
      let ownerRewardAccount = ownerMintToAccount[itemReward.mint.address];
      if (!ownerRewardAccount) {
        const { account, instructionParams } =
          await raydium.account.getOrCreateTokenAccount({
            tokenProgram: new PublicKey(itemReward.mint.programId),
            mint: new PublicKey(itemReward.mint.address),
            notUseTokenAccount: rewardUseSOLBalance,
            owner: raydium.ownerPubKey,
            skipCloseAccount: !rewardUseSOLBalance,
            createInfo: { payer: feePayer, amount: 0 },
            associatedOnly: rewardUseSOLBalance ? false : true,
          });
        ownerRewardAccount = account!;
        instructionParams && txBuilder.addInstruction(instructionParams);
      }
      ownerMintToAccount[itemReward.mint.address] = ownerRewardAccount;
      rewardAccounts.push(ownerRewardAccount!);
    }

    // Build decrease liquidity (0) instructions for each position
    for (const itemPosition of allPositions[itemInfo.id]) {
      const insData = ClmmInstrument.decreaseLiquidityInstructions({
        poolInfo,
        poolKeys,
        ownerPosition: itemPosition,
        ownerInfo: {
          wallet: raydium.ownerPubKey,
          tokenAccountA: ownerTokenAccountA,
          tokenAccountB: ownerTokenAccountB,
          rewardAccounts,
        },
        liquidity: new BN(0),
        amountMinA: new BN(0),
        amountMinB: new BN(0),
        nft2022: nftOwnerRecord[itemPosition.nftMint.toBase58()]?.equals(
          TOKEN_2022_PROGRAM_ID,
        ),
      });
      txBuilder.addInstruction(insData);
    }
  }

  return txBuilder.sizeCheckBuild({ computeBudgetConfig });
}

export function useHarvestAllClmmRewards(
  raydium: Raydium | undefined,
  wallet: AnchorWallet | undefined,
) {
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestError, setHarvestError] = useState<Error | undefined>(
    undefined,
  );

  const harvest = useCallback(
    async ({ positions, poolInfos }: HarvestAllParams) => {
      if (!raydium || !wallet?.publicKey) return undefined;

      setIsHarvesting(true);
      setHarvestError(undefined);

      try {
        // Group positions by pool ID
        const allPoolInfo: Record<string, ApiV3PoolInfoConcentratedItem> =
          {};
        const allPositions: Record<string, ClmmPositionLayout[]> = {};
        const allPoolKeys: Record<string, ClmmKeys> = {};

        for (const pos of positions) {
          const poolId = pos.poolId.toBase58();
          const info = poolInfos[poolId];
          if (!info) continue;

          const poolInfoId = info.poolInfo.id;
          allPoolInfo[poolInfoId] = info.poolInfo;
          allPoolKeys[poolInfoId] = info.poolKeys;

          if (!allPositions[poolInfoId]) {
            allPositions[poolInfoId] = [];
          }
          allPositions[poolInfoId].push(pos.positionLayout);
        }

        if (Object.keys(allPoolInfo).length === 0) {
          throw new Error("No valid pool info found for harvesting");
        }

        const txData = await buildHarvestAllRewardsTx(
          raydium,
          allPoolInfo,
          allPositions,
          allPoolKeys,
          wallet.publicKey,
          { units: 600000, microLamports: 100000 },
        );

        const { execute } = txData;

        const { txIds } = await execute({
          sendAndConfirm: true,
          sequentially: true,
        });

        const txId = txIds[0];

        await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });

        setIsHarvesting(false);
        return txId;
      } catch (err) {
        console.error("[harvest] error:", err);
        const error =
          err instanceof Error ? err : new Error("Unknown error occurred");
        setIsHarvesting(false);
        setHarvestError(error);
        throw error;
      }
    },
    [raydium, wallet],
  );

  return { harvest, isHarvesting, harvestError };
}
