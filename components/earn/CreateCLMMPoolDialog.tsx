"use client";

import { useEffect, useMemo, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TokenProfile } from "@/lib/config/tokens";
import { BalanceMapByMint, PoolStateWithConfig } from "@/lib/hooks/chain/types";
import { usePrices } from "@/lib/hooks/usePrices";
import { text } from "@/lib/text";
import { cn, parseDecimalsInput } from "@/lib/utils";
import { TokenLabel } from "../TokenLabel";
import { TokenSelectorDialog } from "../swap/TokenSelectorDialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CreatePoolButton } from "./CreatePoolButton";
import { FEE_TIERS, FeeTierSelection } from "./FeeTierSelection";
import { DepositPanel } from "./v2/DepositPanel";
import { CLMMPriceRange } from "./v2/clmm/CLMMPriceRange";
import { PriceMode } from "./v2/types";

interface CreateCLMMPoolDialogProps {
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

export const CreateCLMMPoolDialog = ({
  isOpen,
  splBalances,
  allTokenProfiles,
  poolsData,
  onOpenChange,
}: CreateCLMMPoolDialogProps) => {
  const [tokenA, setTokenA] = useState<TokenProfile | null>(null);
  const [tokenB, setTokenB] = useState<TokenProfile | null>(null);
  const [lpTokenMint, setLpTokenMint] = useState<string | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [amountLp, setAmountLp] = useState("");
  const [initialPrice, setInitialPrice] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>(PriceMode.FULL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
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

  const handlePriceInputChange = (
    value: string,
    setter: (value: string) => void,
  ) => {
    setter(parseDecimalsInput(value));
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

  const isPoolExists = useMemo(() => {
    if (!tokenA || !tokenB || !poolsData) {
      return undefined;
    }

    return !!poolsData?.find(
      (c) =>
        ((c.poolState.token0Mint.toString() === tokenA.address &&
          c.poolState.token1Mint.toString() === tokenB.address) ||
          (c.poolState.token1Mint.toString() === tokenA.address &&
            c.poolState.token0Mint.toString() === tokenB.address)) &&
        c.ammConfig.tradeFeeRate.eq(
          new BN(FEE_TIERS[selectedFeeIndex].fee * 100),
        ),
    );
  }, [poolsData, tokenA, tokenB, selectedFeeIndex]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] min-h-[480px] w-[640px] !max-w-[576px] flex-col gap-0 overflow-hidden">
          <DialogHeader className="h-fit border-b border-gray-800 py-6">
            <DialogTitle className={cn(text.b2(), "leading-none")}>
              Create Market
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-5.5">
                <div className="mt-2 flex flex-col gap-3">
                  <span
                    className={cn(text.b4(), "px-3 leading-none text-gray-400")}
                  >
                    Concentrated Liquidity AMM
                  </span>
                  <span className="w-full border-b border-gray-800" />
                  <span
                    className={cn(
                      text.sb3(),
                      "px-3 leading-none text-gray-600",
                    )}
                  >
                    Advanced liquidity management. Supports preferred price
                    range and full-range deposits.
                  </span>
                </div>

                {/* Token Selector */}
                <div className="flex flex-col gap-3">
                  <div className="flex w-full items-center justify-between gap-1">
                    <div className="w-[50%]">
                      <TokenLabel
                        token={tokenA}
                        label="Select Token A"
                        address={tokenA?.address}
                        disableTokenSelect={false}
                        onTokenSelect={() =>
                          handleOpenTokenSelector(SelectTokenType.TOKEN_A)
                        }
                        className="w-full justify-between p-5"
                        tokenClassName="gap-4.5"
                      />
                    </div>
                    <div className="w-[50%]">
                      <TokenLabel
                        token={tokenB}
                        label="Select Token B"
                        address={tokenB?.address}
                        disableTokenSelect={false}
                        onTokenSelect={() =>
                          handleOpenTokenSelector(SelectTokenType.TOKEN_B)
                        }
                        className="w-full justify-between p-5"
                        tokenClassName="gap-4.5"
                      />
                    </div>
                  </div>
                  {isPoolExists && (
                    <div
                      className={cn(
                        text.sb4(),
                        "text-orange bg-orange/10 flex w-full items-center justify-center rounded-xl py-4",
                      )}
                    >
                      The Pool Already Exist
                    </div>
                  )}
                </div>

                {/* Initial price */}
                <div className="flex w-full flex-col gap-3">
                  <div
                    className={cn(
                      text.b4(),
                      "flex items-center px-3 text-gray-400",
                    )}
                  >
                    Initial Price
                  </div>
                  <div className="w-full border-b border-gray-800" />
                  <div
                    className={cn(
                      text.sb3(),
                      "bg-black-700 flex w-full items-center justify-between gap-4 rounded-xl p-4",
                    )}
                  >
                    <input
                      type="text"
                      value={initialPrice}
                      onChange={(e) =>
                        handlePriceInputChange(e.target.value, setInitialPrice)
                      }
                      className={cn(
                        text.sh1(),
                        "flex-1 text-left text-white outline-none placeholder:text-gray-600",
                      )}
                      placeholder="0.0"
                      // disabled={disabled || !isActionable}
                    />
                    <p className={cn(text.sb3(), "text-right text-gray-600")}>
                      {tokenA ? tokenA.name : "Token A"} per{" "}
                      {tokenB ? tokenB.name : "Token B"}
                    </p>
                  </div>
                </div>

                {/* Fee tier selection */}
                <FeeTierSelection
                  selectedFeeIndex={selectedFeeIndex}
                  onSelectFeeIndex={setSelectedFeeIndex}
                />
                {/* Full / Custom price range selection */}
                <div className="flex flex-col gap-7">
                  <SegmentedControl
                    value={priceMode}
                    onValueChange={(value) =>
                      setPriceMode(
                        value === PriceMode.CUSTOM
                          ? PriceMode.CUSTOM
                          : PriceMode.FULL,
                      )
                    }
                    options={[
                      { value: PriceMode.FULL, label: "Full" },
                      { value: PriceMode.CUSTOM, label: "Custom" },
                    ]}
                    className={{
                      group: "w-full justify-between !rounded-xl bg-gray-800",
                      item: cn(
                        text.b3(),
                        "hover:bg-gray-750 h-fit flex-1 !rounded-lg py-3 text-center",
                      ),
                    }}
                  />

                  {priceMode === PriceMode.CUSTOM && (
                    <CLMMPriceRange
                      minPrice={minPrice}
                      maxPrice={maxPrice}
                      // handlePriceInputChange={handlePriceInputChange}
                      handleMinPriceChange={setMinPrice}
                      handleMaxPriceChange={setMaxPrice}
                    />
                  )}
                  <div className="flex flex-col gap-4">
                    <DepositPanel
                      tokenA={tokenA}
                      tokenB={tokenB}
                      lpTokenMint={lpTokenMint}
                      walletBalances={splBalances}
                      priceMap={prices}
                      tokenAInput={amountA}
                      tokenBInput={amountB}
                      onAmountAChange={setAmountA}
                      onAmountBChange={setAmountB}
                      onAmountLPChange={setAmountLp}
                      className="p-0"
                      ratioClassName="px-3"
                    />
                    <div className="border-b border-dashed" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3">
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
                isPoolExists={isPoolExists}
              />
            </div>
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
