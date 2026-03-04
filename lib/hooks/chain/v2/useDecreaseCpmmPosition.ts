import { useCallback, useState } from "react";
import { Percent, Raydium, TxVersion } from "@doxxorg/cpmm-sdk";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import {
  BPS,
  DEFAULT_DECREASE_CPMM_SLIPPAGE,
  NATIVE_SOL_MINT,
} from "@/lib/constants";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  compareTokenAddressesString,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { RawCPMMPoolInfo } from "../types";

interface DecreaseCpmmPositionParams {
  // position: IUserCPMMPositionWithValue;
  // amountMinA: BN;
  // amountMinB: BN;
  // isClosePosition: boolean;
  lpAmount: BN;
}

// interface UnclaimedRewards {
//   hasFees: boolean;
//   hasRewards: boolean;
//   feesA: BN;
//   feesB: BN;
//   rewards: Array<{ mint: PublicKey; amount: BN }>;
// }

export function useDecreaseCpmmPosition(
  raydium: Raydium | undefined,
  wallet: AnchorWallet | undefined,
  poolInfo: RawCPMMPoolInfo | undefined,
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
  // const checkUnclaimedRewards = (
  //   position: IUserCPMMPositionWithValue,
  //   poolInfo: RawCPMMPoolInfo,
  // ): UnclaimedRewards => {
  //   // Check trading fees
  //   const feesA = position.fees.token0.amountRaw || new BN(0);
  //   const feesB = position.fees.token1.amountRaw || new BN(0);
  //   const hasFees = feesA.gt(new BN(0)) || feesB.gt(new BN(0));

  //   // Check liquidity mining rewards
  //   const rewards: Array<{ mint: PublicKey; amount: BN }> = [];

  //   if (position.rewardInfos && poolInfo) {
  //     for (let i = 0; i < position.rewardInfos.length; i++) {
  //       const posReward = position.rewardInfos[i];
  //       const poolReward = poolInfo.poolInfo.rewardInfos[i];

  //       // Check if reward slot is initialized
  //       if (
  //         poolReward &&
  //         poolReward.tokenMint &&
  //         !poolReward.tokenMint.equals(PublicKey.default)
  //       ) {
  //         const amount = posReward.rewardAmountOwed || new BN(0);

  //         if (amount.gt(new BN(0))) {
  //           rewards.push({
  //             mint: poolReward.tokenMint,
  //             amount,
  //           });
  //         }
  //       }
  //     }
  //   }

  //   const hasRewards = rewards.length > 0;

  //   return {
  //     hasFees,
  //     hasRewards,
  //     feesA,
  //     feesB,
  //     rewards,
  //   };
  // };

  /**
   * Collect all fees and rewards from a position
   */
  // const collectAllRewards = async (
  //   raydium: Raydium,
  //   position: IUserCPMMPositionWithValue,
  //   poolInfo: RawCPMMPoolInfo,
  //   wallet: AnchorWallet,
  // ): Promise<string | null> => {
  //   // console.log("🎁 Collecting fees and rewards...");

  //   try {
  //     const allPoolInfo = { [poolInfo.poolInfo.id]: poolInfo.poolInfo };
  //     const allPositions = {
  //       [position.lpMint.toBase58()]: [position],
  //     };

  //     // Use SDK's harvest rewards function
  //     const { execute } = await raydium.cpmm.harvestAllRewards({
  //       allPoolInfo,
  //       allPositions,
  //       clmmProgram: DOXX_CLMM_PROGRAM_ID,
  //       ownerInfo: {
  //         useSOLBalance: true, // Handle SOL unwrapping
  //       },
  //       txVersion: TxVersion.LEGACY,
  //       feePayer: wallet.publicKey,
  //       computeBudgetConfig: {
  //         units: 600000,
  //         microLamports: 100000,
  //       },
  //     });

  //     const { txIds } = await execute({
  //       sendAndConfirm: true,
  //       sequentially: true,
  //     });
  //     // console.log("🚀 ~ txIds:", txIds);
  //     // Always have only one txId for closing
  //     const txId = txIds[0];

  //     // console.log("✅ Fees and rewards collected:", txId);

  //     // Wait for confirmation
  //     const status = await pollSignatureStatus({
  //       connection: raydium.connection,
  //       signature: txId,
  //       timeoutMs: 120000,
  //     });

  //     if (!status) {
  //       throw new Error("Reward collection transaction not found on chain");
  //     }

  //     return txId;
  //   } catch (error) {
  //     console.error("❌ Failed to collect rewards:", error);
  //     throw error;
  //   }
  // };

  const decreaseCpmmPosition = useCallback(
    async (params: DecreaseCpmmPositionParams) => {
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
        const { lpAmount } = params;

        const isSOL =
          compareTokenAddressesString(
            poolInfo.poolInfo.mintA.address,
            NATIVE_SOL_MINT,
          ) ||
          compareTokenAddressesString(
            poolInfo.poolInfo.mintB.address,
            NATIVE_SOL_MINT,
          );

        // const ownerPosition = position.positionLayout;
        // if (isClosePosition) {
        //   const unclaimedRewards = checkUnclaimedRewards(position, poolInfo);
        //   console.log("Unclaimed rewards check:", {
        //     hasFees: unclaimedRewards.hasFees,
        //     hasRewards: unclaimedRewards.hasRewards,
        //     feesA: unclaimedRewards.feesA.toString(),
        //     feesB: unclaimedRewards.feesB.toString(),
        //     rewardsCount: unclaimedRewards.rewards.length,
        //   });

        //   // Collect fees/rewards before closing
        //   if (unclaimedRewards.hasFees || unclaimedRewards.hasRewards) {
        //     console.log(
        //       "⚠️ Collecting fees and rewards before closing position...",
        //     );

        //     try {
        //       const collectTxId = await collectAllRewards(
        //         raydium,
        //         position,
        //         poolInfo,
        //         wallet,
        //       );
        //       console.log("✅ Collected rewards in tx:", collectTxId);

        //       // Small delay to ensure state is updated
        //       await new Promise((resolve) => setTimeout(resolve, 1000));
        //     } catch (collectError) {
        //       console.error("Failed to collect rewards:", collectError);

        //       throw new Error(
        //         "Failed to collect rewards before closing position",
        //       );
        //     }
        //   }
        // }

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

        const { execute } = await raydium.cpmm.withdrawLiquidity({
          poolInfo: poolInfo.poolInfo,
          poolKeys: poolInfo.poolKeys,
          lpAmount,
          slippage: new Percent(DEFAULT_DECREASE_CPMM_SLIPPAGE * BPS, BPS),
          closeWsol: isSOL,
          txVersion: TxVersion.V0,
          payer: wallet.publicKey,
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
    decreaseCpmmPosition,
    isDecreasing,
    decreaseError,
  };
}
