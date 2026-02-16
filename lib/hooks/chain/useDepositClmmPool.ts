import { useCallback, useRef, useState } from "react";
import { BN, Program } from "@coral-xyz/anchor";
import {
  PoolUtils,
  Raydium,
  TickUtils,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import { PriceMode } from "@/components/earn/v2/types";
import { clientEnvConfig } from "@/lib/config/envConfig";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/constants";
import { DoxxClmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
  normalizeBN,
  parseAmountBN,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { CLMMPoolState } from "./types";

type DepositClmmPoolParams = {
  poolId: string;
  poolState: CLMMPoolState;
  ammConfig: PublicKey;
  tickSpacing: number;

  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;

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

      try {
        console.log("🚀 ~ params:", params);
        const {
          ammConfig,
          tickSpacing,
          tokenAMint,
          tokenBMint,
          tokenADecimals,
          tokenBDecimals,
          // initialPriceAperB,
          baseIn,
          amountA,
          amountB,
          priceMode,
          minPriceAperB,
          maxPriceAperB,
          maxAmountBufferPct = 0.02,
          poolState: clmmPoolState,
          poolId,
        } = params;

        const raydium = await Raydium.load({
          connection: connection,
          urlConfigs: {
            RPCS: clientEnvConfig.NEXT_PUBLIC_RPC_URL,
          },
          owner: wallet.publicKey,
          signAllTransactions: wallet.signAllTransactions,
        });

        console.log("🚀 ~ poolId:", poolId.toString());
        const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
        const poolInfo = data.poolInfo;
        const poolKeys = data.poolKeys;

        const [startPrice, endPrice] = [
          new Decimal(minPriceAperB || "0"),
          new Decimal(maxPriceAperB || "0"),
        ];

        const { tick: lowerTick } = TickUtils.getPriceAndTick({
          poolInfo,
          price: startPrice,
          baseIn,
        });

        const { tick: upperTick } = TickUtils.getPriceAndTick({
          poolInfo,
          price: endPrice,
          baseIn,
        });
        const epochInfo = await raydium.fetchEpochInfo();

        const baseToken = baseIn ? poolInfo.mintA : poolInfo.mintB;
        const baseTokenDecimals = baseToken.decimals;
        const baseRawAmount = baseIn ? amountA : amountB;
        const baseAmount = parseAmountBN(baseRawAmount, baseTokenDecimals);

        const otherToken = baseIn ? poolInfo.mintB : poolInfo.mintA;
        const otherTokenDecimals = otherToken.decimals;
        const otherRawAmount = baseIn ? amountB : amountA;
        const otherAmount = parseAmountBN(otherRawAmount, otherTokenDecimals);

        const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
          poolInfo,
          slippage: 0,
          inputA: baseIn,
          tickUpper: Math.max(lowerTick, upperTick),
          tickLower: Math.min(lowerTick, upperTick),
          amount: baseAmount,
          add: true,
          amountHasFee: true,
          epochInfo: epochInfo,
        });

        const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
          poolInfo,
          poolKeys,
          tickUpper: Math.max(lowerTick, upperTick),
          tickLower: Math.min(lowerTick, upperTick),
          base: baseIn ? "MintA" : "MintB",
          nft2022: true,
          feePayer: wallet.publicKey,
          ownerInfo: {
            useSOLBalance: true,
          },
          baseAmount,
          otherAmountMax: res.amountSlippageB.amount,

          txVersion: TxVersion.V0,
          // optional: set up priority fee here
          computeBudgetConfig: {
            units: 600000,
            microLamports: 100000,
          },
        });
        console.log("🚀 ~ extInfo:", extInfo.personalPosition.toString());
        console.log("🚀 ~ extInfo:", extInfo.positionNftAccount.toString());
        console.log("🚀 ~ extInfo:", extInfo.nftMint.toString());

        const { txId, signedTx } = await execute({ sendAndConfirm: true });

        const status = await pollSignatureStatus({
          connection,
          signature: txId,
          timeoutMs: 120000,
        });

        if (!status) {
          onError(new Error("TransactionNotFoundOnChain"), txId);
          setIsDepositing(false);
          return undefined;
        }

        onSuccess(txId);
        setIsDepositing(false);
        return txId;
      } catch (e) {
        onError(err);
        setDepositError(
          new Error(err instanceof Error ? err.message : "Unknown error"),
        );
        setIsDepositing(false);
        return undefined;
      }
    },
    [program, wallet?.publicKey, onSuccess, onError, resolveTokenProgramId],
  );

  return { createPosition, isDepositing, depositError };
}
