import { useCallback, useState } from "react";
import { Program } from "@coral-xyz/anchor";
import { Percent, Raydium, TxVersion } from "@doxxorg/cpmm-sdk";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { BPS, DEFAULT_CREATE_CPMM_SLIPPAGE } from "@/lib/constants";
import { DoxxCpmmIdl } from "@/lib/idl";
import {
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  PROVIDER_UNAVAILABLE_ERROR,
} from "@/lib/utils";
import { pollSignatureStatus } from "@/lib/utils/solanaTxFallback";
import { PrepareOpenCPMMPositionData } from "./types";

type DepositCPMMParams = {
  prepareOpenCPMMPositionData: PrepareOpenCPMMPositionData | undefined;
};

export function useDepositCPMM(
  raydium: Raydium | undefined,
  program: Program<DoxxCpmmIdl> | undefined,
  wallet: AnchorWallet | undefined,
  baseIn: boolean,
  onSuccess: (tx?: string) => void,
  onError: (e: Error) => void,
) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<Error | undefined>();

  const deposit = useCallback(
    async (params: DepositCPMMParams) => {
      setIsDepositing(true);
      setDepositError(undefined);

      if (!program || !wallet?.publicKey) {
        setIsDepositing(false);
        setDepositError(new Error(PROGRAM_WALLET_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const { provider } = program;
      if (!provider || !raydium) {
        setIsDepositing(false);
        setDepositError(new Error(PROVIDER_UNAVAILABLE_ERROR.message));
        return undefined;
      }

      const prepareOpenCPMMPositionData = params.prepareOpenCPMMPositionData;
      if (!prepareOpenCPMMPositionData || !raydium) {
        setIsDepositing(false);
        setDepositError(new Error("Cannot simulate deposit CPMM position"));
        return undefined;
      }

      try {
        const { execute } = await raydium.cpmm.addLiquidity({
          poolInfo: prepareOpenCPMMPositionData.poolInfo,
          poolKeys: prepareOpenCPMMPositionData.poolKeys,
          slippage: new Percent(DEFAULT_CREATE_CPMM_SLIPPAGE * BPS, BPS),
          computeResult: {
            anotherAmount: prepareOpenCPMMPositionData.anotherAmount,
            maxAnotherAmount: prepareOpenCPMMPositionData.maxAnotherAmount,
            liquidity: prepareOpenCPMMPositionData.liquidity,
            inputAmountFee: prepareOpenCPMMPositionData.inputAmountFee,
          },
          inputAmount: prepareOpenCPMMPositionData.inputAmountFee.amount,
          payer: wallet.publicKey,
          baseIn,
          txVersion: TxVersion.V0,
          feePayer: wallet.publicKey,
        });

        const { txId } = await execute({ sendAndConfirm: true });
        const status = await pollSignatureStatus({
          connection: raydium.connection,
          signature: txId,
          timeoutMs: 120000,
        });
        if (!status) {
          const error = new Error("Transaction not found on chain");
          onError(error);
          setDepositError(error);
          setIsDepositing(false);
          return undefined;
        }

        onSuccess(txId);
        setIsDepositing(false);
        return txId;
      } catch (e) {
        console.log("🚀 ~ Deposit error:", e);
        onError(e as Error);
        setDepositError(
          new Error(e instanceof Error ? e.message : "Unknown error"),
        );
        setIsDepositing(false);
        return undefined;
      }
    },
    [program, onSuccess, onError, wallet, raydium, baseIn],
  );

  return {
    deposit,
    isDepositing,
    depositError,
  };
}
