"use client";

import { useMemo, useState } from "react";
import { SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectButtonWrapper } from "@/components/wallet/ConnectButtonWrapper";
import { text } from "@/lib/text";
import { parseDecimalsInput } from "@/lib/utils/number";
import { cn } from "@/lib/utils/style";
import { TradingPair } from "../trading-pair-header/types";
import { TradeMarketPanel } from "./TradeMarketPanel";

enum OrderType {
  Buy = "Buy",
  Sell = "Sell",
}

const ButtonPanel = ({
  title,
  onClick,
  active,
  className,
}: {
  title: string;
  onClick?: () => void;
  active: boolean;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "px-2 py-4 hover:cursor-pointer hover:bg-gray-800",
        active
          ? "border-b border-white text-white"
          : "text-gray-500 hover:text-gray-300",
        className,
      )}
      onClick={onClick}
    >
      {title}
    </div>
  );
};

enum OrderMode {
  Market,
  Trigger,
}

const orderModes = [
  {
    title: "Market",
    value: OrderMode.Market,
  },
  {
    title: "Trigger",
    value: OrderMode.Trigger,
  },
];

interface ProTradePanelProps {
  balance?: number;
  selectedPair: TradingPair;
}

export function ProTradePanel({
  balance = 6058.04,
  selectedPair,
}: ProTradePanelProps) {
  const [orderType, setOrderType] = useState<OrderType>(OrderType.Buy);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setOrderMode] = useState<OrderMode>(OrderMode.Market);
  const [inputAmount, setInputAmount] = useState("");
  const [slippage] = useState("1%");
  const [gasFee] = useState("$0.0001");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePercentageClick = (percentage: number) => {
    const amount = ((balance * percentage) / 100).toFixed(2);
    setInputAmount(amount);
  };

  const handleInputAmountChange = (value: string) => {
    setInputAmount(parseDecimalsInput(value));
  };

  const amountReceived = useMemo(() => {
    if (inputAmount === "") return 0;
    return parseFloat(inputAmount) / selectedPair.lastPrice;
  }, [inputAmount, selectedPair.lastPrice]);

  const totalValue = parseFloat(inputAmount) || 0;

  return (
    <div className="bg-black-900 flex h-full flex-col border-l-2 border-gray-800">
      <div
        className={cn(
          text.b3(),
          "flex w-full items-center border-b border-gray-800 px-2",
        )}
      >
        <ButtonPanel title="Trade" active={true} />
      </div>

      <div className="flex flex-col gap-10 p-3">
        <div className="flex flex-col gap-3">
          {/* Buy/Sell Buttons */}
          <div className="w-full">
            <SegmentedControl
              className={{
                group:
                  "!w-full justify-between gap-0 !rounded-[12px] bg-gray-800",
                item: "data-[state=on]:!bg-green/15 hover:bg-gray-750 h-fit w-[50%] !rounded-[8px] !py-3 leading-none",
              }}
              value={orderType}
              onValueChange={(value) => setOrderType(value as OrderType)}
              options={Object.values(OrderType).map((type) => ({
                value: type.toString(),
                label: type.toString(),
              }))}
            />
          </div>
          {/* Market/Trigger Tabs */}
          <Tabs defaultValue={`${OrderMode.Market}`}>
            <div className="flex w-full items-center justify-between gap-3">
              <TabsList className="grow-0">
                {orderModes.map((mode) => (
                  <TabsTrigger
                    key={`trade-panel-tab-${mode.value}`}
                    value={`${mode.value}`}
                    onClick={() => setOrderMode(mode.value)}
                  >
                    {mode.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              <SettingsIcon className="size-4 text-gray-500" />
            </div>
            <TabsContent value={`${OrderMode.Market}`}>
              <TradeMarketPanel
                balance={balance}
                inputAmount={inputAmount}
                onInputAmountChange={handleInputAmountChange}
                amountReceived={amountReceived}
                selectedPair={selectedPair}
                totalValue={totalValue}
                gasFee={gasFee}
                slippage={slippage}
              />
            </TabsContent>
            <TabsContent value={`${OrderMode.Trigger}`}>
              TODO: Trigger Panel
            </TabsContent>
          </Tabs>
        </div>

        {/* Connect Wallet / Trade Button */}
        <ConnectButtonWrapper className={cn(text.hsb1(), "w-full rounded-lg")}>
          <Button
            className={cn("h-14 w-full")}
            disabled={!inputAmount || parseFloat(inputAmount) === 0}
          >
            {orderType} {selectedPair.symbol}
          </Button>
        </ConnectButtonWrapper>
      </div>
    </div>
  );
}
