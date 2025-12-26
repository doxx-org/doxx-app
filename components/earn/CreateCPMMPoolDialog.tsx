"use client";

import { useEffect, useState } from "react";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PoolStateWithConfig } from "@/lib/hooks/chain/types";
import { usePrices } from "@/lib/hooks/usePrices";
import { text } from "@/lib/text";
import { cn, parseDecimalsInput } from "@/lib/utils";
import { TokenSelectorDialog } from "../swap/TokenSelectorDialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CreatePoolButton } from "./CreatePoolButton";
import { FeeTierSelection } from "./FeeTierSelection";
import { DepositLPPanel } from "./v2/DepositLPPanel";

interface CreateCPMMPoolDialogProps {
  isOpen: boolean;
  splBalances: BalanceMapByMint | undefined;
  allTokenProfiles: TokenProfile[];
  poolsData: PoolStateWithConfig[] | undefined;
  onOpenChange: (open: boolean) => void;
}

enum SelectTokenType {
  TOKEN_A,
  TOKEN_B,
}

export const CreateCPMMPoolDialog = ({
  isOpen,
  splBalances,
  allTokenProfiles,
  poolsData,
  onOpenChange,
}: CreateCPMMPoolDialogProps) => {
  const [tokenA, setTokenA] = useState<TokenProfile | null>(null);
  const [tokenB, setTokenB] = useState<TokenProfile | null>(null);
  const [lpTokenMint, setLpTokenMint] = useState<string | null>(null);
  console.log("🚀 ~ lpTokenMint:", lpTokenMint);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [selectedTokenType, setSelectedTokenType] = useState<SelectTokenType>(
    SelectTokenType.TOKEN_A,
  );
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);

  const { data: prices } = usePrices();

  const handleSelectToken = (token: TokenProfile) => {
    if (selectedTokenType === SelectTokenType.TOKEN_A) {
      // If token B is the same as the new token A, clear it
      if (tokenB?.address.toLowerCase() === token.address.toLowerCase()) {
        setTokenB(null);
        setAmountB("");
      }
      setTokenA(token);
    } else if (selectedTokenType === SelectTokenType.TOKEN_B) {
      // If token A is the same as the new token B, clear it
      if (tokenA?.address.toLowerCase() === token.address.toLowerCase()) {
        setTokenA(null);
        setAmountA("");
      }
      setTokenB(token);
    }
    setIsTokenSelectorOpen(false);
  };

  const handleAmountChange = (
    value: string,
    setAmount: (value: string) => void,
  ) => {
    setAmount(parseDecimalsInput(value));
  };

  const handleOpenTokenSelector = (tokenType: SelectTokenType) => {
    setSelectedTokenType(tokenType);
    setIsTokenSelectorOpen(true);
  };

  useEffect(() => {
    if (!poolsData || !tokenA || !tokenB || poolsData.length === 0) {
      setLpTokenMint("");
      return;
    }

    const poolData = poolsData.find(
      (c) =>
        (c.poolState.token0Mint.toString() === tokenA.address &&
          c.poolState.token1Mint.toString() === tokenB.address) ||
        (c.poolState.token1Mint.toString() === tokenA.address &&
          c.poolState.token0Mint.toString() === tokenB.address),
    );

    if (!poolData) {
      setLpTokenMint("");
      return;
    }

    setLpTokenMint(poolData.poolState.lpMint.toString());
  }, [poolsData, tokenA, tokenB]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[480px] w-[640px] !max-w-[576px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle className={cn(text.b2(), "leading-none")}>
              Create Market
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col justify-between gap-4 p-3">
            <div className="flex flex-col gap-5.5">
              <div className="mt-2 flex flex-col gap-3">
                <span
                  className={cn(text.b4(), "px-3 leading-none text-gray-400")}
                >
                  Constant Factor AMM
                </span>
                <span className="w-full border-b border-gray-800" />
                <span
                  className={cn(text.sb3(), "px-3 leading-none text-gray-600")}
                >
                  Constant product pools follow the distribution XY=K.
                </span>
              </div>
              {/* Token A and Token B Selection */}
              <DepositLPPanel
                tokenA={tokenA}
                tokenB={tokenB}
                lpTokenMint={lpTokenMint}
                walletBalances={splBalances}
                priceMap={prices}
                tokenAInput={amountA}
                tokenBInput={amountB}
                onAmountAChange={(value) =>
                  handleAmountChange(value, setAmountA)
                }
                onAmountBChange={(value) =>
                  handleAmountChange(value, setAmountB)
                }
                onTokenASelect={() =>
                  handleOpenTokenSelector(SelectTokenType.TOKEN_A)
                }
                onTokenBSelect={() =>
                  handleOpenTokenSelector(SelectTokenType.TOKEN_B)
                }
                formatter={{
                  tokenA: {
                    input: {
                      abbreviate: { apply: false },
                    },
                    balance: {
                      abbreviate: { apply: false },
                    },
                    usd: {
                      abbreviate: { apply: false },
                    },
                  },
                  tokenB: {
                    input: {
                      abbreviate: { apply: false },
                    },
                    balance: {
                      abbreviate: { apply: false },
                    },
                    usd: {
                      abbreviate: { apply: false },
                    },
                  },
                  lpToken: {
                    input: {
                      abbreviate: { apply: false },
                    },
                    balance: {
                      abbreviate: { apply: false },
                    },
                    usd: {
                      abbreviate: { apply: false },
                    },
                  },
                }}
              />
              <FeeTierSelection
                selectedFeeIndex={selectedFeeIndex}
                onSelectFeeIndex={setSelectedFeeIndex}
              />
            </div>
            <CreatePoolButton
              tokenA={tokenA}
              tokenB={tokenB}
              amountA={amountA}
              amountB={amountB}
              onSelectTokenA={setTokenA}
              onSelectTokenB={setTokenB}
              onAmountChangeA={setAmountA}
              onAmountChangeB={setAmountB}
              onOpenChange={onOpenChange}
              selectedFeeIndex={selectedFeeIndex}
              poolsData={poolsData}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Token Selector Dialog */}
      {isTokenSelectorOpen && (
        <TokenSelectorDialog
          isOpen={isTokenSelectorOpen}
          onOpenChange={setIsTokenSelectorOpen}
          tokenProfiles={allTokenProfiles}
          onSelectToken={handleSelectToken}
        />
      )}
    </>
  );
};
