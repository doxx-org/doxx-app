"use client";

import { useState } from "react";
import * as motion from "motion/react-client";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

export default function TradingToggle() {
  const [isPro, setIsPro] = useState(true);

  const toggleSwitch = () => setIsPro(!isPro);

  return (
    <button
      className={cn(
        "pointer-none flex w-21 items-center justify-between rounded-full border-1 p-2 align-middle",
        isPro ? "flex-row-reverse" : "flex-row",

        isPro
          ? "to-green/20 bg-gradient-to-l from-[#1C1C1C]/30 from-[54%]"
          : "to-red/20 bg-gradient-to-r from-[#1C1C1C]/30 from-[54%]",
        isPro ? "border-green/40" : "border-red/40",
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
        {isPro ? "LITE" : "PRO"}
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
