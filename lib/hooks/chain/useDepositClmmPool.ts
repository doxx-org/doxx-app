import { useCallback, useState } from "react";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PriceMode } from "@/components/earn/v2/types";
import { NATIVE_SOL_MINT } from "@/lib/constants";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  compareTokenAddressesString,
  getTickRangeFromPriceMode,
  parseAmountBN,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { PrepareOpenCLMMPositionData } from "./types";

type DepositClmmPoolParams = {
  // poolId: string;
  // poolState: CLMMPoolState;
  // ammConfig: PublicKey;
  tickSpacing: number;

  // tokenAMint: PublicKey;
  // tokenBMint: PublicKey;
  // tokenADecimals: number;
  // tokenBDecimals: number;

  /** UI price: tokenA per tokenB (A/B). Used to initialize pool sqrtPrice. */
  // initialPriceAperB: string;

  baseIn: boolean;

  /** Amounts user wants to deposit into the initial position (UI token units). */
  amountA: string;
  amountB: string;

  /** Price range (UI token units, tokenA per tokenB). */
  priceMode: PriceMode;
  minPriceAperB?: string;
  maxPriceAperB?: string;

  /** Extra buffer for amount_0_max / amount_1_max slippage checks (e.g. 0.02 = +2%). */
  // maxAmountBufferPct?: number;
  prepareOpenCLMMPositionData: PrepareOpenCLMMPositionData | undefined;
};

export function useDepositClmmPool(
  raydium: Raydium | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error, txSignature?: string) => void,
) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<Error | undefined>();

  const createPosition = useCallback(
    async (params: DepositClmmPoolParams) => {
      setIsDepositing(true);
      setDepositError(undefined);

      if (!wallet?.publicKey) {
        setIsDepositing(false);
        setDepositError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const prepareOpenCLMMPositionData = params.prepareOpenCLMMPositionData;
      if (!prepareOpenCLMMPositionData || !raydium) {
        setIsDepositing(false);
        setDepositError(new Error("Cannot simulate deposit CLMM position"));
        return undefined;
      }

      try {
        const {
          tickSpacing,
          baseIn,
          amountA,
          amountB,
          priceMode,
          minPriceAperB,
          maxPriceAperB,
        } = params;

        const { poolInfo, poolKeys } = prepareOpenCLMMPositionData;

        // Determine tick range based on price mode
        // eslint-disable-next-line prefer-const
        let [lowerTick, upperTick] = getTickRangeFromPriceMode(
          priceMode,
          tickSpacing,
          poolInfo,
          baseIn,
          minPriceAperB,
          maxPriceAperB,
        );

        // Ensure upper > lower
        if (upperTick <= lowerTick) {
          upperTick = lowerTick + tickSpacing;
          console.warn("Adjusted upperTick to be greater than lowerTick");
        }

        // Determine base token and amounts
        const baseToken = baseIn ? poolInfo.mintA : poolInfo.mintB;
        const baseTokenDecimals = baseToken.decimals;
        const baseRawAmount = baseIn ? amountA : amountB;
        const baseAmount = parseAmountBN(baseRawAmount, baseTokenDecimals);
        const otherAmountMax = baseIn
          ? prepareOpenCLMMPositionData.amountSlippageB.amount
          : prepareOpenCLMMPositionData.amountSlippageA.amount;

        // console.log("Liquidity calculation:", {
        //   liquidity: prepareOpenCLMMPositionData.liquidity.toString(),
        //   amountSlippageA:
        //     prepareOpenCLMMPositionData.amountSlippageA.amount.toString(),
        //   amountSlippageB:
        //     prepareOpenCLMMPositionData.amountSlippageB.amount.toString(),
        // });

        const isInputOutputSOL =
          compareTokenAddressesString(
            poolInfo.mintA.address,
            NATIVE_SOL_MINT,
          ) ||
          compareTokenAddressesString(poolInfo.mintB.address, NATIVE_SOL_MINT);

        // Open position using SDK
        const { execute } = await raydium.clmm.openPositionFromBase({
          poolInfo,
          poolKeys,
          tickUpper: Math.max(lowerTick, upperTick),
          tickLower: Math.min(lowerTick, upperTick),
          base: baseIn ? "MintA" : "MintB",
          nft2022: true, // Use Token-2022 for position NFT
          feePayer: wallet.publicKey,
          ownerInfo: {
            useSOLBalance: isInputOutputSOL, // Unwrap SOL if needed
          },
          baseAmount,
          otherAmountMax, // Max other token amount with slippage

          txVersion: TxVersion.V0,
          computeBudgetConfig: {
            units: 600000,
            microLamports: 100000,
          },
        });

        // console.log("Position info:", {
        //   personalPosition: extInfo.personalPosition.toString(),
        //   positionNftAccount: extInfo.positionNftAccount.toString(),
        //   nftMint: extInfo.nftMint.toString(),
        //   tickLower: lowerTick,
        //   tickUpper: upperTick,
        // });

        // Execute transaction
        const { txId } = await execute({ sendAndConfirm: true });
        // console.log("Transaction sent:", txId);

        // Poll for confirmation
        const status = await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });

        if (!status) {
          const error = new Error("Transaction not found on chain");
          onError(error, txId);
          setDepositError(error);
          setIsDepositing(false);
          return undefined;
        }

        // console.log("✅ Position created successfully:", txId);
        onSuccess(txId);
        setIsDepositing(false);
        return txId;
      } catch (err) {
        console.error("❌ Error creating position:", err);

        const error =
          err instanceof Error ? err : new Error("Unknown error occurred");

        onError(error);
        setDepositError(error);
        setIsDepositing(false);
        return undefined;
      }
    },

    [raydium, onSuccess, onError, wallet],
  );

  return { createPosition, isDepositing, depositError };
}
