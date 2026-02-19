import { useCallback, useRef, useState } from "react";
import { Program } from "@coral-xyz/anchor";
import {
  Raydium,
  ReturnTypeGetLiquidityAmountOut,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { PriceMode } from "@/components/earn/v2/types";
import { clientEnvConfig } from "@/lib/config/envConfig";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/constants";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
  getTickRangeFromPriceMode,
  parseAmountBN,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { CLMMPoolState } from "./types";

type DepositClmmPoolParams = {
  poolId: string;
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
  maxAmountBufferPct?: number;
  prepareOpenCLMMPositionData: ReturnTypeGetLiquidityAmountOut | undefined;
};

export function useDepositClmmPool(
  connection: Connection,
  program: Program<DoxxClmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  onSuccess: (tx?: string) => void,
  onError: (e: Error, txSignature?: string) => void,
) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<Error | undefined>();
  const mintProgramCache = useRef(new Map<string, PublicKey>());

  const resolveTokenProgramId = useCallback(
    async (mint: PublicKey): Promise<PublicKey> => {
      const key = mint.toBase58();
      const cached = mintProgramCache.current.get(key);
      if (cached) return cached;
      const info = await connection.getAccountInfo(mint);
      const owner = info?.owner;
      const programId =
        owner && owner.equals(TOKEN_2022_PROGRAM_ID)
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;
      mintProgramCache.current.set(key, programId);
      return programId;
    },
    [connection],
  );

  const createPosition = useCallback(
    async (params: DepositClmmPoolParams) => {
      setIsDepositing(true);
      setDepositError(undefined);

      if (!program || !wallet?.publicKey) {
        setIsDepositing(false);
        setDepositError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider) {
        setIsDepositing(false);
        setDepositError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const prepareOpenCLMMPositionData = params.prepareOpenCLMMPositionData;
      if (!prepareOpenCLMMPositionData) {
        setIsDepositing(false);
        setDepositError(new Error("Cannot simulate deposit CLMM position"));
        return undefined;
      }

      try {
        console.log("🚀 ~ params:", params);
        const {
          poolId,
          tickSpacing,
          baseIn,
          amountA,
          amountB,
          priceMode,
          minPriceAperB,
          maxPriceAperB,
        } = params;

        // Initialize Raydium SDK
        const raydium = await Raydium.load({
          connection: connection,
          urlConfigs: {
            RPCS: clientEnvConfig.NEXT_PUBLIC_RPC_URL,
          },
          owner: wallet.publicKey,
          signAllTransactions: wallet.signAllTransactions,
        });

        // Fetch pool info from RPC
        const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
        const poolInfo = data.poolInfo;
        const poolKeys = data.poolKeys;

        // Determine tick range based on price mode
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

        console.log("Liquidity calculation:", {
          liquidity: prepareOpenCLMMPositionData.liquidity.toString(),
          amountSlippageA:
            prepareOpenCLMMPositionData.amountSlippageA.amount.toString(),
          amountSlippageB:
            prepareOpenCLMMPositionData.amountSlippageB.amount.toString(),
        });

        // Open position using SDK
        const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
          poolInfo,
          poolKeys,
          tickUpper: Math.max(lowerTick, upperTick),
          tickLower: Math.min(lowerTick, upperTick),
          base: baseIn ? "MintA" : "MintB",
          nft2022: true, // Use Token-2022 for position NFT
          feePayer: wallet.publicKey,
          ownerInfo: {
            useSOLBalance: true, // Unwrap SOL if needed
          },
          baseAmount,
          otherAmountMax: prepareOpenCLMMPositionData.amountSlippageB.amount, // Max other token amount with slippage

          txVersion: TxVersion.V0,
          computeBudgetConfig: {
            units: 600000,
            microLamports: 100000,
          },
        });

        console.log("Position info:", {
          personalPosition: extInfo.personalPosition.toString(),
          positionNftAccount: extInfo.positionNftAccount.toString(),
          nftMint: extInfo.nftMint.toString(),
          tickLower: lowerTick,
          tickUpper: upperTick,
        });

        // Execute transaction
        const { txId, signedTx } = await execute({ sendAndConfirm: true });
        console.log("Transaction sent:", txId);

        // Poll for confirmation
        const status = await pollSignatureStatus({
          connection,
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

        console.log("✅ Position created successfully:", txId);
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
    [program, wallet?.publicKey, connection, onSuccess, onError],
  );

  return { createPosition, isDepositing, depositError };
}
