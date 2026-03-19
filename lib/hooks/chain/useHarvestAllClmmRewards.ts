import { useCallback, useState } from "react";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { DOXX_CLMM_PROGRAM_ID } from "@/lib/idl";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { IPositionWithValue, RawPoolInfo } from "./types";

interface HarvestAllParams {
  positions: IPositionWithValue[];
  poolInfos: Record<string, RawPoolInfo>;
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
        // Aggregate allPoolInfo and allPositions across all pools
        const allPoolInfo: Record<string, RawPoolInfo["poolInfo"]> = {};
        const allPositions: Record<
          string,
          IPositionWithValue["positionLayout"][]
        > = {};

        for (const pos of positions) {
          const poolId = pos.poolId.toBase58();
          const info = poolInfos[poolId];
          if (!info) continue;

          allPoolInfo[info.poolInfo.id] = info.poolInfo;

          const nftMint = pos.positionLayout.nftMint.toBase58();
          if (!allPositions[nftMint]) {
            allPositions[nftMint] = [];
          }
          allPositions[nftMint].push(pos.positionLayout);
        }

        if (Object.keys(allPoolInfo).length === 0) {
          throw new Error("No valid pool info found for harvesting");
        }

        const { execute } = await raydium.clmm.harvestAllRewards({
          allPoolInfo,
          allPositions,
          clmmProgram: DOXX_CLMM_PROGRAM_ID,
          ownerInfo: {
            useSOLBalance: true,
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

        const txId = txIds[0];

        await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });

        setIsHarvesting(false);
        return txId;
      } catch (err) {
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
