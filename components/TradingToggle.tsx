"use client";

import { useAtom } from "jotai";
import * as motion from "motion/react-client";
import { text } from "@/lib/text";
import { TradingMode, tradingModeAtom } from "@/lib/utils/storage";
import { cn } from "@/lib/utils/style";

export default function TradingToggle() {
  const [tradingMode, setTradingMode] = useAtom(tradingModeAtom);

  const toggleSwitch = () => {
    return setTradingMode(
      tradingMode === TradingMode.PRO ? TradingMode.LITE : TradingMode.PRO,
    );
  };

  return (
    <button
      className={cn(
        "pointer-none flex w-21 items-center justify-between rounded-full border-1 p-2 align-middle",
        tradingMode === TradingMode.LITE ? "flex-row-reverse" : "flex-row",

        tradingMode === TradingMode.LITE
          ? "to-green/20 bg-gradient-to-l from-[#1C1C1C]/30 from-[54%]"
          : "to-red/20 bg-gradient-to-r from-[#1C1C1C]/30 from-[54%]",
        tradingMode === TradingMode.LITE ? "border-green/40" : "border-red/40",
      )}
      onClick={toggleSwitch}
    >
      <motion.div
        className={cn(text.hsb3(), "px-2")}
        layout
        transition={{
          type: "spring",
          visualDuration: 0.2,
          bounce: 0.2,
        }}
      >
        {tradingMode === TradingMode.LITE ? "LITE" : "PRO"}
      </motion.div>
      <motion.div
        className="h-6 w-6 rounded-full bg-gray-50"
        layout
        transition={{
          type: "spring",
          visualDuration: 0.2,
          bounce: 0.2,
        }}
      />
    </button>
  );
}
