import { Program } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  GetTransferAmountFee,
  MEMO_PROGRAM_ID,
  PoolUtils,
  Raydium,
  ReturnTypeFetchMultiplePoolTickArrays,
  Rounding,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import {
  NATIVE_MINT,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  EpochInfo,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { PoolType } from "@/components/earn/v2/types";
import { TokenProfile } from "../config/tokens";
import {
  NATIVE_SOL_MINT,
  ONE_E9,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "../constants";
import {
  CLMMPoolStateWithConfig,
  CPMMPoolStateWithConfig,
} from "../hooks/chain/types";
import { DoxxClmmIdl } from "../idl";
import { isTokenMatchPool } from "./address";
import { normalizeBPS } from "./number";

interface IFindBestClmmSwapParams {
  raydium: Raydium;
  clmmPools: CLMMPoolStateWithConfig[] | undefined;
  inputToken: TokenProfile;
  outputToken: TokenProfile;
  slippageBps: number;
  epochInfo: EpochInfo;
}

interface IFindBestClmmSwapBaseInParams extends IFindBestClmmSwapParams {
  amountIn: BN;
  // raydium: Raydium;
  // clmmPools: CLMMPoolStateWithConfig[] | undefined;
  // inputMint: PublicKey;
  // outputMint: PublicKey;
  // epochInfo: EpochInfo;
}

interface IComputeClmmSwapBaseIn
  extends Omit<
    IFindBestClmmSwapBaseInParams,
    "clmmPools" | "slippageBps" | "inputToken" | "outputToken"
  > {
  slippage: number;
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  computePoolInfo: ComputeClmmPoolInfo;
  tickData: ReturnTypeFetchMultiplePoolTickArrays;
  inputMint: PublicKey;
  outputMint: PublicKey;
}

interface IFindBestClmmSwapBaseOutParams extends IFindBestClmmSwapParams {
  // raydium: Raydium;
  // clmmPools: CLMMPoolStateWithConfig[] | undefined;
  amountOut: BN;
  // inputMint: PublicKey;
  // outputMint: PublicKey;
  // epochInfo: EpochInfo;
}

interface IComputeClmmSwapBaseOut
  extends Omit<
    IFindBestClmmSwapBaseOutParams,
    "clmmPools" | "slippageBps" | "inputToken" | "outputToken" | "swapState"
  > {
  slippage: number;
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  computePoolInfo: ComputeClmmPoolInfo;
  tickData: ReturnTypeFetchMultiplePoolTickArrays;
  inputMint: PublicKey;
  outputMint: PublicKey;
}

interface IBuildSwapParams {
  raydium: Raydium;
  program: Program<DoxxClmmIdl>;
  wallet: AnchorWallet;
  amountIn: BN;
  amountOut: BN;
  inputMint: PublicKey;
  outputMint: PublicKey;
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  remainingAccounts: PublicKey[];
  baseIn: boolean;
}

interface IBuildSwapBaseInExecute
  extends Omit<IBuildSwapParams, "amountOut" | "baseIn"> {
  // raydium: Raydium;
  // program: Program<DoxxClmmIdl>;
  // wallet: AnchorWallet;
  // amountIn: BN;
  amountOutMin: BN;
  // inputMint: PublicKey;
  // outputMint: PublicKey;
  // poolInfo: ApiV3PoolInfoConcentratedItem;
  // poolKeys: ClmmKeys;
  // remainingAccounts: PublicKey[];
}

interface IBuildSwapBaseOutExecute
  extends Omit<IBuildSwapParams, "amountIn" | "baseIn"> {
  // raydium: Raydium;
  // program: Program<DoxxClmmIdl>;
  // wallet: AnchorWallet;
  amountInMax: BN;
  // amountOut: BN;
  // inputMint: PublicKey;
  // outputMint: PublicKey;
  // poolInfo: ApiV3PoolInfoConcentratedItem;
  // poolKeys: ClmmKeys;
  // remainingAccounts: PublicKey[];
}

export interface ISwapStateV2 {
  token0: PublicKey;
  token1: PublicKey;
  token0Amount: BN;
  token1Amount: BN;
  token0Decimals: number;
  token1Decimals: number;
  isBaseExactIn: boolean;
  amountOutPerOneTokenIn: BN;
  amountInPerOneTokenOut: BN;
  minMaxAmount: BN;
  priceImpact: string;
}

export interface IBestRouteV2BaseIn {
  poolType: PoolType;
  pool: CLMMPoolStateWithConfig | CPMMPoolStateWithConfig;
  minAmountOut: GetTransferAmountFee & { tokenDecimals: number };
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  remainingAccounts: PublicKey[];
  swapState: ISwapStateV2;
}

export interface IBestRouteV2BaseOut {
  poolType: PoolType;
  pool: CLMMPoolStateWithConfig | CPMMPoolStateWithConfig;
  maxAmountIn: GetTransferAmountFee & { tokenDecimals: number };
  poolInfo: ApiV3PoolInfoConcentratedItem;
  poolKeys: ClmmKeys;
  remainingAccounts: PublicKey[];
  swapState: ISwapStateV2;
}

export interface IBestRouteV2 {
  bestRouteBaseIn?: IBestRouteV2BaseIn | undefined;
  bestRouteBaseOut?: IBestRouteV2BaseOut | undefined;
}

type GetBestQuoteSwapStateBase = Omit<
  ISwapStateV2,
  "isBaseExactIn" | "minMaxAmount"
>;

function computeClmmSwapBaseIn({
  raydium,
  amountIn,
  inputMint,
  outputMint,
  poolInfo,
  poolKeys,
  computePoolInfo,
  tickData,
  epochInfo,
  slippage,
}: IComputeClmmSwapBaseIn) {
  // let computePoolInfo;
  // let tickCache;
  // if (raydium.cluster === "mainnet") {
  //   // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
  //   const data = await raydium.api.fetchPoolById({ ids: poolId });
  //   poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;

  //   computePoolInfo = await PoolUtils.fetchComputeClmmInfo({
  //     connection: raydium.connection,
  //     poolInfo,
  //   });
  //   tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
  //     connection: raydium.connection,
  //     poolKeys: [computePoolInfo],
  //   });
  // }

  if (
    !isTokenMatchPool(
      inputMint,
      outputMint,
      new PublicKey(poolInfo.mintA.address),
      new PublicKey(poolInfo.mintB.address),
    )
  )
    throw new Error("Input mint does not match pool");

  const baseIn =
    inputMint.toString().toLowerCase() === poolInfo.mintA.address.toLowerCase();
  const tokenOut = baseIn ? poolInfo.mintB : poolInfo.mintA;

  return PoolUtils.computeAmountOutFormat({
    poolInfo: computePoolInfo,
    tickArrayCache: tickData[poolInfo.id.toString()],
    amountIn,
    tokenOut,
    slippage,
    epochInfo,
    catchLiquidityInsufficient: true,
  });
}

export async function findBestClmmSwapBaseIn({
  raydium,
  clmmPools,
  amountIn,
  inputToken,
  outputToken,
  epochInfo,
  slippageBps,
}: IFindBestClmmSwapBaseInParams): Promise<IBestRouteV2BaseIn | undefined> {
  if (!clmmPools) return undefined;

  const slippage = normalizeBPS(slippageBps);

  let bestPool: CLMMPoolStateWithConfig | undefined;
  let bestMinAmountOut: GetTransferAmountFee | undefined = undefined;
  let bestRemainingAccounts: PublicKey[] = [];
  let bestSwapState: GetBestQuoteSwapStateBase | undefined = undefined;
  let bestPoolInfo: ApiV3PoolInfoConcentratedItem | undefined = undefined;
  let bestPoolKeys: ClmmKeys | undefined = undefined;

  const inputMint = new PublicKey(inputToken.address);
  const outputMint = new PublicKey(outputToken.address);
  const tokenMatchPools = clmmPools.filter((pool) =>
    isTokenMatchPool(
      inputMint,
      outputMint,
      pool.poolState.tokenMint0,
      pool.poolState.tokenMint1,
    ),
  );

  const allPoolIds = tokenMatchPools.map((pool) => pool.poolId.toBase58());

  const rawPoolInfos = await Promise.allSettled(
    allPoolIds.map((id) => raydium.clmm.getPoolInfoFromRpc(id)),
  );

  const filterdFulfilledPoolInfos = rawPoolInfos
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  for (const [index, rawPoolInfo] of filterdFulfilledPoolInfos.entries()) {
    const pool = tokenMatchPools[index];
    const poolInfo = rawPoolInfo.poolInfo;
    const poolKeys = rawPoolInfo.poolKeys;
    const computePoolInfo = rawPoolInfo.computePoolInfo;
    const tickData = rawPoolInfo.tickData;

    const {
      minAmountOut,
      remainingAccounts,
      currentPrice,
      amountOut,
      priceImpact,
    } = computeClmmSwapBaseIn({
      raydium,
      amountIn,
      inputMint,
      outputMint,
      poolInfo,
      poolKeys,
      computePoolInfo,
      tickData,
      epochInfo,
      slippage,
    });

    // If the current pool has a greater min amount out, set it as the best
    if (
      !bestMinAmountOut ||
      minAmountOut.amount.raw.gt(bestMinAmountOut.amount)
    ) {
      bestMinAmountOut = {
        amount: minAmountOut.amount.raw,
        fee: minAmountOut.fee?.raw,
        expirationTime: minAmountOut.expirationTime,
      };
      bestRemainingAccounts = remainingAccounts;
      bestPool = pool;
      bestPoolInfo = poolInfo;
      bestPoolKeys = poolKeys;

      // amount out per one token in
      const amountOutPerOneTokenIn = amountOut.amount.raw
        .mul(ONE_E9)
        .div(amountIn);

      // amount in per one token out
      const amountInPerOneTokenOut = amountIn
        .mul(ONE_E9)
        .div(amountOut.amount.raw);

      bestSwapState = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: amountIn,
        token1Amount: amountOut.amount.raw,
        token0Decimals: inputToken.decimals,
        token1Decimals: outputToken.decimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: priceImpact.toSignificant(2, {}, Rounding.ROUND_HALF_UP),
      };
    }
  }

  if (
    !bestMinAmountOut ||
    !bestPool ||
    !bestSwapState ||
    !bestPoolInfo ||
    !bestPoolKeys
  )
    return undefined;

  return {
    poolType: PoolType.CLMM,
    pool: bestPool as CLMMPoolStateWithConfig,
    minAmountOut: {
      ...bestMinAmountOut,
      tokenDecimals: outputToken.decimals,
    },
    remainingAccounts: bestRemainingAccounts,
    poolInfo: bestPoolInfo,
    poolKeys: bestPoolKeys,
    swapState: {
      ...bestSwapState,
      isBaseExactIn: true,
      minMaxAmount: bestMinAmountOut.amount,
    },
  };
}

function computeClmmSwapBaseOut({
  raydium,
  amountOut,
  inputMint,
  outputMint,
  poolInfo,
  poolKeys,
  computePoolInfo,
  tickData,
  epochInfo,
  slippage,
}: IComputeClmmSwapBaseOut) {
  // let computePoolInfo;
  // let tickCache;
  // if (raydium.cluster === "mainnet") {
  //   // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
  //   const data = await raydium.api.fetchPoolById({ ids: poolId });
  //   poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;

  //   computePoolInfo = await PoolUtils.fetchComputeClmmInfo({
  //     connection: raydium.connection,
  //     poolInfo,
  //   });
  //   tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
  //     connection: raydium.connection,
  //     poolKeys: [computePoolInfo],
  //   });
  // }

  if (
    !isTokenMatchPool(
      inputMint,
      outputMint,
      new PublicKey(poolInfo.mintA.address),
      new PublicKey(poolInfo.mintB.address),
    )
  )
    throw new Error("Input mint does not match pool");

  return PoolUtils.computeAmountIn({
    poolInfo: computePoolInfo,
    tickArrayCache: tickData[poolInfo.id.toString()],
    amountOut,
    baseMint: outputMint,
    slippage,
    epochInfo,
  });
}

export async function findBestClmmSwapBaseOut({
  raydium,
  clmmPools,
  amountOut,
  inputToken,
  outputToken,
  epochInfo,
  slippageBps,
}: IFindBestClmmSwapBaseOutParams): Promise<IBestRouteV2BaseOut | undefined> {
  if (!clmmPools) return undefined;

  const slippage = normalizeBPS(slippageBps);

  let bestPool: CLMMPoolStateWithConfig | undefined;
  let bestMaxAmountIn: GetTransferAmountFee | undefined = undefined;
  let bestRemainingAccounts: PublicKey[] = [];
  let bestSwapState: GetBestQuoteSwapStateBase | undefined = undefined;
  let bestPoolKeys: ClmmKeys | undefined = undefined;
  let bestPoolInfo: ApiV3PoolInfoConcentratedItem | undefined = undefined;

  const inputMint = new PublicKey(inputToken.address);
  const outputMint = new PublicKey(outputToken.address);
  const tokenMatchPools = clmmPools.filter((pool) =>
    isTokenMatchPool(
      inputMint,
      outputMint,
      pool.poolState.tokenMint0,
      pool.poolState.tokenMint1,
    ),
  );

  const allPoolIds = tokenMatchPools.map((pool) => pool.poolId.toBase58());

  const rawPoolInfos = await Promise.allSettled(
    allPoolIds.map((id) => raydium.clmm.getPoolInfoFromRpc(id)),
  );

  const filterdFulfilledPoolInfos = rawPoolInfos
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  for (const [index, rawPoolInfo] of filterdFulfilledPoolInfos.entries()) {
    const pool = tokenMatchPools[index];
    const poolInfo = rawPoolInfo.poolInfo;
    const poolKeys = rawPoolInfo.poolKeys;
    const computePoolInfo = rawPoolInfo.computePoolInfo;
    const tickData = rawPoolInfo.tickData;

    const {
      maxAmountIn,
      amountIn,
      currentPrice,
      priceImpact,
      fee,
      remainingAccounts,
    } = computeClmmSwapBaseOut({
      raydium,
      amountOut,
      inputMint,
      outputMint,
      poolInfo,
      poolKeys,
      computePoolInfo,
      tickData,
      epochInfo,
      slippage,
    });

    // If the current pool has a greater min amount out, set it as the best
    if (!bestMaxAmountIn || maxAmountIn.amount.gt(bestMaxAmountIn.amount)) {
      bestMaxAmountIn = {
        amount: maxAmountIn.amount,
        fee: maxAmountIn.fee,
        expirationTime: maxAmountIn.expirationTime,
      };
      bestRemainingAccounts = remainingAccounts;
      bestPool = pool;
      bestPoolInfo = poolInfo;
      bestPoolKeys = poolKeys;

      const amountOutPerOneTokenIn = amountOut.mul(ONE_E9).div(amountIn.amount);
      const amountInPerOneTokenOut = amountIn.amount.mul(ONE_E9).div(amountOut);

      bestSwapState = {
        token0: inputMint,
        token1: outputMint,
        token0Amount: amountIn.amount,
        token1Amount: amountOut,
        token0Decimals: inputToken.decimals,
        token1Decimals: outputToken.decimals,
        amountOutPerOneTokenIn,
        amountInPerOneTokenOut,
        priceImpact: priceImpact.toSignificant(2, {}, Rounding.ROUND_HALF_UP),
      };
    }
  }

  if (
    !bestMaxAmountIn ||
    !bestSwapState ||
    !bestPool ||
    !bestPoolInfo ||
    !bestPoolKeys
  )
    return undefined;

  return {
    poolType: PoolType.CLMM,
    pool: bestPool,
    poolInfo: bestPoolInfo,
    poolKeys: bestPoolKeys,
    maxAmountIn: {
      ...bestMaxAmountIn,
      tokenDecimals: inputToken.decimals,
    },
    remainingAccounts: bestRemainingAccounts,
    swapState: {
      ...bestSwapState,
      isBaseExactIn: false,
      minMaxAmount: bestMaxAmountIn.amount,
    },
  };
}

export async function _buildSwapExecuteBaseIn({
  raydium,
  amountIn,
  amountOutMin,
  inputMint,
  poolInfo,
  poolKeys,
  remainingAccounts,
  wallet,
}: IBuildSwapBaseInExecute) {
  const isInputSOL = inputMint.toString() === NATIVE_SOL_MINT;

  const { execute, extInfo } = await raydium.clmm.swap({
    poolInfo,
    poolKeys,
    inputMint,
    amountIn,
    amountOutMin,
    observationId: new PublicKey(poolKeys.observationId),
    ownerInfo: {
      useSOLBalance: isInputSOL, // if wish to use existed wsol token account, pass false
      feePayer: wallet.publicKey,
    },
    remainingAccounts,
    txVersion: TxVersion.V0,
    checkCreateATAOwner: true,
    associatedOnly: true,
    feePayer: wallet.publicKey,
    computeBudgetConfig: {
      units: 400000,
      microLamports: 100000,
    },
    // optional: set up priority fee here
    // computeBudgetConfig: {
    //   units: 600000,
    //   microLamports: 465915,
    // },

    // optional: add transfer sol to tip account instruction. e.g sent tip to jito
    // txTipConfig: {
    //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    //   amount: new BN(10000000), // 0.01 sol
    // },
  });

  return { execute, extInfo };
}

export async function _buildSwapExecuteBaseOut({
  raydium,
  wallet,
  amountInMax,
  amountOut,
  inputMint,
  outputMint,
  poolInfo,
  poolKeys,
  remainingAccounts,
}: IBuildSwapBaseOutExecute) {
  const isInputSOL = inputMint.toString() === NATIVE_SOL_MINT;

  const { execute, extInfo } = await raydium.clmm.swapBaseOut({
    poolInfo,
    poolKeys,
    outputMint,
    amountInMax,
    amountOut,
    observationId: new PublicKey(poolKeys.observationId),
    ownerInfo: {
      useSOLBalance: isInputSOL, // if wish to use existed wsol token account, pass false
      feePayer: wallet.publicKey,
    },
    remainingAccounts,
    txVersion: TxVersion.V0,
    checkCreateATAOwner: true,
    associatedOnly: true,
    feePayer: wallet.publicKey,
    computeBudgetConfig: {
      units: 400000,
      microLamports: 100000,
    },

    // optional: set up priority fee here
    // computeBudgetConfig: {
    //   units: 600000,
    //   microLamports: 465915,
    // },

    // optional: add transfer sol to tip account instruction. e.g sent tip to jito
    // txTipConfig: {
    //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    //   amount: new BN(10000000), // 0.01 sol
    // },
  });

  return { execute, extInfo };
}

export async function buildSwapExecuteBaseIn({
  raydium,
  program,
  amountIn,
  amountOutMin,
  inputMint,
  outputMint,
  poolInfo,
  poolKeys,
  remainingAccounts,
  wallet,
}: IBuildSwapBaseInExecute) {
  // Check if Memo program is executable on this chain
  const memoInfo = await raydium.connection.getAccountInfo(MEMO_PROGRAM_ID);
  const memoExecutable = memoInfo?.executable === true;

  console.log("Memo program executable:", memoExecutable);

  const isInputSOL = inputMint.toString() === NATIVE_SOL_MINT;

  if (!memoExecutable) {
    console.warn(
      "⚠️ Memo program not found or not executable. Using legacy swap instruction.",
    );

    // Use legacy swap (without memo)
    return buildLegacySwapWithSOLWrapping({
      // return buildLegacySwap({
      raydium,
      program,
      amountIn,
      amountOut: amountOutMin,
      inputMint,
      outputMint,
      poolInfo,
      poolKeys,
      remainingAccounts,
      wallet,
      baseIn: true,
    });
  }

  // Use modern swap_v2 (with memo)
  const { execute, extInfo } = await raydium.clmm.swap({
    poolInfo,
    poolKeys,
    inputMint,
    amountIn,
    amountOutMin,
    observationId: new PublicKey(poolKeys.observationId),
    ownerInfo: {
      useSOLBalance: isInputSOL,
    },
    remainingAccounts,
    txVersion: TxVersion.V0,
    checkCreateATAOwner: true,
    associatedOnly: true,
    feePayer: wallet.publicKey,
    computeBudgetConfig: {
      units: 400000,
      microLamports: 100000,
    },
  });

  return { execute, extInfo };
}

export async function buildSwapExecuteBaseOut({
  raydium,
  program,
  wallet,
  amountInMax,
  amountOut,
  inputMint,
  outputMint,
  poolInfo,
  poolKeys,
  remainingAccounts,
}: IBuildSwapBaseOutExecute) {
  const isInputSOL = inputMint.toString() === NATIVE_SOL_MINT;

  // Check if Memo program is executable on this chain
  const memoInfo = await raydium.connection.getAccountInfo(MEMO_PROGRAM_ID);
  const memoExecutable = memoInfo?.executable === true;

  console.log("Memo program executable:", memoExecutable);

  if (!memoExecutable) {
    console.warn(
      "⚠️ Memo program not found or not executable. Using legacy swap instruction.",
    );

    // Use legacy swap (without memo)
    return buildLegacySwapWithSOLWrapping({
      // return buildLegacySwap({
      raydium,
      program,
      amountIn: amountInMax,
      amountOut,
      inputMint,
      outputMint,
      poolInfo,
      poolKeys,
      remainingAccounts,
      wallet,
      baseIn: false,
    });
  }

  const { execute, extInfo } = await raydium.clmm.swapBaseOut({
    poolInfo,
    poolKeys,
    outputMint,
    amountInMax,
    amountOut,
    observationId: new PublicKey(poolKeys.observationId),
    ownerInfo: {
      useSOLBalance: isInputSOL, // if wish to use existed wsol token account, pass false
      feePayer: wallet.publicKey,
    },
    remainingAccounts,
    txVersion: TxVersion.V0,
    checkCreateATAOwner: true,
    associatedOnly: true,
    feePayer: wallet.publicKey,
    computeBudgetConfig: {
      units: 400000,
      microLamports: 100000,
    },

    // optional: set up priority fee here
    // computeBudgetConfig: {
    //   units: 600000,
    //   microLamports: 465915,
    // },

    // optional: add transfer sol to tip account instruction. e.g sent tip to jito
    // txTipConfig: {
    //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    //   amount: new BN(10000000), // 0.01 sol
    // },
  });

  return { execute, extInfo };
}

interface BuildV0TransactionParams {
  connection: Connection;
  payer: PublicKey;
  instructions: TransactionInstruction[];
  lookupTableAccounts?: AddressLookupTableAccount[];
  computeBudgetConfig?: {
    units?: number;
    microLamports?: number;
  };
}

/**
 * Build a V0 (versioned) transaction
 */
export async function buildV0Transaction({
  connection,
  payer,
  instructions,
  lookupTableAccounts = [],
  computeBudgetConfig,
}: BuildV0TransactionParams): Promise<{
  transaction: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  // Add compute budget instructions if provided
  const allInstructions: TransactionInstruction[] = [];

  if (computeBudgetConfig) {
    if (computeBudgetConfig.units) {
      allInstructions.push(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeBudgetConfig.units,
        }),
      );
    }
    if (computeBudgetConfig.microLamports) {
      allInstructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: computeBudgetConfig.microLamports,
        }),
      );
    }
  }

  allInstructions.push(...instructions);

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  // Create V0 message
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: allInstructions,
  }).compileToV0Message(lookupTableAccounts);

  // Create versioned transaction
  const transaction = new VersionedTransaction(messageV0);

  return {
    transaction,
    blockhash,
    lastValidBlockHeight,
  };
}

/**
 * Legacy swap without memo program requirement
 */
async function buildLegacySwap({
  raydium,
  program,
  amountIn,
  amountOutMin,
  inputMint,
  poolInfo,
  poolKeys,
  remainingAccounts,
  wallet,
}: IBuildSwapBaseInExecute) {
  // Unfortunately, Raydium SDK v0.2.32-alpha doesn't expose legacy swap directly
  // We need to build the transaction manually using the program

  // Get program from SDK
  // const program = raydium.clmm.program;

  // if (!program) {
  //   throw new Error("CLMM program not initialized in SDK");
  // }

  // Determine swap direction
  const inputIsA = inputMint.equals(new PublicKey(poolInfo.mintA.address));
  const inputVault = inputIsA
    ? new PublicKey(poolKeys.vault.A)
    : new PublicKey(poolKeys.vault.B);
  const outputVault = inputIsA
    ? new PublicKey(poolKeys.vault.B)
    : new PublicKey(poolKeys.vault.A);
  const outputMint = inputIsA
    ? new PublicKey(poolInfo.mintB.address)
    : new PublicKey(poolInfo.mintA.address);

  // Get token programs
  const inputTokenProgram = await resolveTokenProgramId(
    raydium.connection,
    inputMint,
  );
  const outputTokenProgram = await resolveTokenProgramId(
    raydium.connection,
    outputMint,
  );

  // Get user token accounts
  const inputTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    wallet.publicKey,
    false,
    inputTokenProgram,
  );
  const outputTokenAccount = getAssociatedTokenAddressSync(
    outputMint,
    wallet.publicKey,
    false,
    outputTokenProgram,
  );

  // Build legacy swap instruction
  const swapIx = await program.methods
    .swap(
      amountIn,
      amountOutMin,
      new BN(0), // sqrtPriceLimitX64 = 0 (no limit)
      true, // is_base_input = true
    )
    .accounts({
      payer: wallet.publicKey,
      ammConfig: poolKeys.config.id,
      poolState: poolKeys.id,
      inputTokenAccount,
      outputTokenAccount,
      inputVault,
      outputVault,
      observationState: poolKeys.observationId,
      tickArray: remainingAccounts[0], // First tick array
      // tokenProgram: TOKEN_PROGRAM_ID,
      // tokenProgram2022: TOKEN_2022_PROGRAM_ID,
    })
    .remainingAccounts(
      remainingAccounts.slice(1).map((pk) => ({
        pubkey: pk,
        isWritable: true,
        isSigner: false,
      })),
    )
    .instruction();

  // Build transaction
  const { transaction } = await buildV0Transaction({
    connection: raydium.connection,
    payer: wallet.publicKey,
    instructions: [swapIx],
    computeBudgetConfig: {
      units: 400000,
      microLamports: 100000,
    },
  });

  // Return execute function
  const execute = async ({ sendAndConfirm }: { sendAndConfirm: boolean }) => {
    const signed = await wallet.signTransaction(transaction);
    const txId = await raydium.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: true,
        maxRetries: 3,
      },
    );

    if (sendAndConfirm) {
      await raydium.connection.confirmTransaction(txId);
    }

    return { txId };
  };

  return {
    execute,
    extInfo: {
      amountIn: { amount: amountIn },
      amountOut: { amount: amountOutMin }, // Rough estimate
      minAmountOut: { amount: amountOutMin },
      priceImpact: "0",
      fee: [],
    },
  };
}

async function buildLegacySwapWithSOLWrapping({
  program,
  raydium,
  wallet,
  amountIn,
  amountOut,
  inputMint,
  outputMint,
  poolKeys,
  poolInfo,
  remainingAccounts,
  baseIn,
}: IBuildSwapParams) {
  const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
  const isInputSOL = inputMint.equals(SOL_MINT);
  const isOutputSOL = outputMint.equals(SOL_MINT);

  const instructions: TransactionInstruction[] = [];

  // 1. Compute budget
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), // More CUs for wrapping
  );
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  );

  // 2. Handle input token account
  let inputTokenAccount: PublicKey;

  if (isInputSOL) {
    // Wrap SOL to WSOL
    inputTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    // Create WSOL account if needed
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        inputTokenAccount,
        wallet.publicKey,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID,
      ),
    );

    // Transfer SOL to WSOL account
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: inputTokenAccount,
        lamports: amountIn.toNumber(),
      }),
    );

    // Sync native (convert SOL to WSOL)
    instructions.push(
      createSyncNativeInstruction(inputTokenAccount, TOKEN_PROGRAM_ID),
    );
  } else {
    // Regular SPL token
    inputTokenAccount = getAssociatedTokenAddressSync(
      inputMint,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        inputTokenAccount,
        wallet.publicKey,
        inputMint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // 3. Handle output token account
  let outputTokenAccount: PublicKey;

  if (isOutputSOL) {
    outputTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        outputTokenAccount,
        wallet.publicKey,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID,
      ),
    );
  } else {
    outputTokenAccount = getAssociatedTokenAddressSync(
      outputMint,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        outputTokenAccount,
        wallet.publicKey,
        outputMint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // 4. Determine vault addresses
  const inputIsA = inputMint.equals(new PublicKey(poolInfo.mintA.address));
  const inputVault = new PublicKey(
    inputIsA ? poolKeys.vault.A : poolKeys.vault.B,
  );
  const outputVault = new PublicKey(
    inputIsA ? poolKeys.vault.B : poolKeys.vault.A,
  );

  const amount1 = baseIn ? amountIn : amountOut;
  const amount2 = baseIn ? amountOut : amountIn;

  // 5. Swap instruction
  const swapIx = await program.methods
    .swap(amount1, amount2, new BN(0), baseIn)
    .accounts({
      payer: wallet.publicKey,
      ammConfig: poolKeys.config.id,
      poolState: poolKeys.id,
      inputTokenAccount,
      outputTokenAccount,
      inputVault,
      outputVault,
      observationState: poolKeys.observationId,
      tickArray: remainingAccounts[0],
    })
    .remainingAccounts(
      remainingAccounts.slice(1).map((pk) => ({
        pubkey: pk,
        isWritable: true,
        isSigner: false,
      })),
    )
    .instruction();

  instructions.push(swapIx);

  // 6. Unwrap WSOL back to SOL (if output is SOL)
  if (isOutputSOL) {
    instructions.push(
      createCloseAccountInstruction(
        outputTokenAccount,
        wallet.publicKey,
        wallet.publicKey,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // 7. Close input WSOL account (if input was SOL and there's leftover)
  if (isInputSOL) {
    instructions.push(
      createCloseAccountInstruction(
        inputTokenAccount,
        wallet.publicKey,
        wallet.publicKey,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Build transaction
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = wallet.publicKey;

  const { blockhash, lastValidBlockHeight } =
    await raydium.connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  const execute = async ({ sendAndConfirm }: { sendAndConfirm: boolean }) => {
    const signed = await wallet.signTransaction(transaction);
    const txId = await raydium.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: false, // Keep preflight for debugging
        maxRetries: 3,
      },
    );

    if (sendAndConfirm) {
      await raydium.connection.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight,
      });
    }

    return { txId };
  };

  return {
    execute,
    extInfo: {
      amountIn: { amount: amountIn },
      amountOut: { amount: amountOut },
      // minAmountOut: { amount: amountOut },
      // priceImpact: "0",
      // fee: [],
    },
  };
}

// Helper: Resolve token program
async function resolveTokenProgramId(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  try {
    const info = await connection.getAccountInfo(mint);
    if (info?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
  } catch {
    return TOKEN_PROGRAM_ID;
  }
}
