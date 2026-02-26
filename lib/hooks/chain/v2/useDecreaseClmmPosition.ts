import { useCallback, useState } from "react";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { NATIVE_SOL_MINT } from "@/lib/constants";
import { DOXX_CLMM_PROGRAM_ID } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  compareTokenAddressesString,
  parseAmountBN,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { IPositionWithValue, RawPoolInfo } from "../types";

interface DecreaseClmmPositionParams {
  liquidity: BN;
  position: IPositionWithValue;
  amountMinA: BN;
  amountMinB: BN;
  isClosePosition: boolean;
}

interface UnclaimedRewards {
  hasFees: boolean;
  hasRewards: boolean;
  feesA: BN;
  feesB: BN;
  rewards: Array<{ mint: PublicKey; amount: BN }>;
}

export function useDecreaseClmmPosition(
  raydium: Raydium | undefined,
  wallet: AnchorWallet | undefined,
  poolInfo: RawPoolInfo | undefined,
  onSuccess: (txId: string) => void,
  onError: (error: Error, txId?: string) => void,
) {
  const [isDecreasing, setIsDecreasing] = useState(false);
  const [decreaseError, setDecreaseError] = useState<Error | undefined>(
    undefined,
  );

  /**
   * Check if position has unclaimed fees or rewards
   */
  const checkUnclaimedRewards = (
    position: IPositionWithValue,
    poolInfo: RawPoolInfo,
  ): UnclaimedRewards => {
    const { positionLayout } = position;

    // Check trading fees
    const feesA = positionLayout.tokenFeesOwedA || new BN(0);
    const feesB = positionLayout.tokenFeesOwedB || new BN(0);
    const hasFees = feesA.gt(new BN(0)) || feesB.gt(new BN(0));

    // Check liquidity mining rewards
    const rewards: Array<{ mint: PublicKey; amount: BN }> = [];

    if (positionLayout.rewardInfos && poolInfo) {
      for (let i = 0; i < positionLayout.rewardInfos.length; i++) {
        const posReward = positionLayout.rewardInfos[i];
        const poolReward = poolInfo.computePoolInfo.rewardInfos[i];

        // Check if reward slot is initialized
        if (
          poolReward &&
          poolReward.tokenMint &&
          !poolReward.tokenMint.equals(PublicKey.default)
        ) {
          const amount = posReward.rewardAmountOwed || new BN(0);

          if (amount.gt(new BN(0))) {
            rewards.push({
              mint: poolReward.tokenMint,
              amount,
            });
          }
        }
      }
    }

    const hasRewards = rewards.length > 0;

    return {
      hasFees,
      hasRewards,
      feesA,
      feesB,
      rewards,
    };
  };

  /**
   * Collect all fees and rewards from a position
   */
  const collectAllRewards = async (
    raydium: Raydium,
    position: IPositionWithValue,
    poolInfo: RawPoolInfo,
    wallet: AnchorWallet,
  ): Promise<string | null> => {
    // console.log("🎁 Collecting fees and rewards...");

    try {
      const allPoolInfo = { [poolInfo.poolInfo.id]: poolInfo.poolInfo };
      const allPositions = {
        [position.positionLayout.nftMint.toBase58()]: [position.positionLayout],
      };

      // Use SDK's harvest rewards function
      const { execute } = await raydium.clmm.harvestAllRewards({
        allPoolInfo,
        allPositions,
        clmmProgram: DOXX_CLMM_PROGRAM_ID,
        ownerInfo: {
          useSOLBalance: true, // Handle SOL unwrapping
        },
        txVersion: TxVersion.LEGACY,
        feePayer: wallet.publicKey,
        computeBudgetConfig: {
          units: 600000,
          microLamports: 100000,
        },
      });

      const { txIds } = await execute({
        sendAndConfirm: true,
        sequentially: true,
      });
      // console.log("🚀 ~ txIds:", txIds);
      // Always have only one txId for closing
      const txId = txIds[0];

      // console.log("✅ Fees and rewards collected:", txId);

      // Wait for confirmation
      const status = await pollSignatureStatus({
        connection: raydium.connection,
        signature: txId,
        timeoutMs: 120000,
      });

      if (!status) {
        throw new Error("Reward collection transaction not found on chain");
      }

      return txId;
    } catch (error) {
      console.error("❌ Failed to collect rewards:", error);
      throw error;
    }
  };

  const decreaseClmmPosition = useCallback(
    async (params: DecreaseClmmPositionParams) => {
      setIsDecreasing(true);
      setDecreaseError(undefined);

      if (!wallet?.publicKey) {
        setIsDecreasing(false);
        setDecreaseError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      if (!raydium || !poolInfo) {
        setIsDecreasing(false);
        setDecreaseError(new Error("Something went wrong, please try again"));
        return undefined;
      }

      try {
        const { amountMinA, amountMinB, liquidity, position, isClosePosition } =
          params;

        const isSOL =
          compareTokenAddressesString(
            poolInfo.poolInfo.mintA.address,
            NATIVE_SOL_MINT,
          ) ||
          compareTokenAddressesString(
            poolInfo.poolInfo.mintB.address,
            NATIVE_SOL_MINT,
          );

        const ownerPosition = position.positionLayout;
        if (isClosePosition) {
          const unclaimedRewards = checkUnclaimedRewards(position, poolInfo);
          console.log("Unclaimed rewards check:", {
            hasFees: unclaimedRewards.hasFees,
            hasRewards: unclaimedRewards.hasRewards,
            feesA: unclaimedRewards.feesA.toString(),
            feesB: unclaimedRewards.feesB.toString(),
            rewardsCount: unclaimedRewards.rewards.length,
          });

          // Collect fees/rewards before closing
          if (unclaimedRewards.hasFees || unclaimedRewards.hasRewards) {
            console.log(
              "⚠️ Collecting fees and rewards before closing position...",
            );

            try {
              const collectTxId = await collectAllRewards(
                raydium,
                position,
                poolInfo,
                wallet,
              );
              console.log("✅ Collected rewards in tx:", collectTxId);

              // Small delay to ensure state is updated
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (collectError) {
              console.error("Failed to collect rewards:", collectError);

              throw new Error(
                "Failed to collect rewards before closing position",
              );
            }
          }
        }

        // const { execute } = isClosePosition
        //   ? await raydium.clmm.closePosition({
        //       poolInfo: poolInfo.poolInfo,
        //       poolKeys: poolInfo.poolKeys,
        //       ownerPosition: temp,
        //       txVersion: TxVersion.V0,
        //       feePayer: wallet.publicKey,
        //       // optional: add transfer sol to tip account instruction. e.g sent tip to jito
        //       // txTipConfig: {
        //       //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
        //       //   amount: new BN(10000000), // 0.01 sol
        //       // },
        //     })
        //   : await raydium.clmm.decreaseLiquidity({
        //       poolInfo: poolInfo.poolInfo,
        //       poolKeys: poolInfo.poolKeys,
        //       ownerPosition: temp,
        //       ownerInfo: {
        //         useSOLBalance: isSOL,
        //         closePosition: false,
        //       },
        //       liquidity,
        //       amountMinA,
        //       amountMinB,
        //       txVersion: TxVersion.V0,
        //       feePayer: wallet.publicKey,
        //       // optional: set up priority fee here
        //       // computeBudgetConfig: {
        //       //   units: 600000,
        //       //   microLamports: 46591500,
        //       // },
        //       // optional: add transfer sol to tip account instruction. e.g sent tip to jito
        //       // txTipConfig: {
        //       //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
        //       //   amount: new BN(10000000), // 0.01 sol
        //       // },
        //     });

        const { execute } = await raydium.clmm.decreaseLiquidity({
          poolInfo: poolInfo.poolInfo,
          poolKeys: poolInfo.poolKeys,
          ownerPosition,
          ownerInfo: {
            useSOLBalance: isSOL,
            closePosition: isClosePosition, // ✅ SDK handles close automatically
          },
          liquidity: isClosePosition ? ownerPosition.liquidity : liquidity,
          amountMinA,
          amountMinB,
          txVersion: TxVersion.V0,
          feePayer: wallet.publicKey,
          computeBudgetConfig: {
            units: 600000,
            microLamports: 100000,
          },
        });

        // Execute transaction
        const { txId } = await execute({ sendAndConfirm: true });

        // Poll for confirmation
        const status = await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });

        if (!status) {
          const error = new Error("Transaction not found on chain");
          onError(error, txId);
          setIsDecreasing(false);
          setDecreaseError(error);
          return undefined;
        }

        onSuccess(txId);
        setIsDecreasing(false);
        return txId;
      } catch (err) {
        console.log("🚀 ~ error:", err);
        const error =
          err instanceof Error ? err : new Error("Unknown error occurred");

        setIsDecreasing(false);
        setDecreaseError(error as Error);
        onError(error);
        return undefined;
      }
    },
    [raydium, wallet, poolInfo, onSuccess, onError],
  );

  return {
    decreaseClmmPosition,
    isDecreasing,
    decreaseError,
  };
}
