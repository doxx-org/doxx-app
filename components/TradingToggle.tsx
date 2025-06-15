"use client";

import { cn } from "@/lib/utils";
import * as motion from "motion/react-client";
import { useState } from "react";

export default function TradingToggle() {
  const [isPro, setIsPro] = useState(true);

  const toggleSwitch = () => setIsPro(!isPro);

  return (
    <button
      className={cn(
        "flex w-18 align-middle justify-between items-center rounded-full pointer-none p-2 border-1",
        isPro ? "flex-row-reverse" : "flex-row",
        isPro
          ? "bg-gradient-to-l from-[#1C1C1C]/30 from-[54%] to-green/20"
          : "bg-gradient-to-r from-[#1C1C1C]/30 from-[54%] to-red/20",
        isPro ? "border-green/40" : "border-red/40"
      )}
      onClick={toggleSwitch}
    >
      <motion.div
        className='text-hsb2 px-[1px]'
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
        className='w-6 h-6 rounded-full bg-gray-50'
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

// /**
//  * ==============   Styles   ================
//  */

// const container = {
//   width: 100,
//   height: 50,
//   backgroundColor: "red",
//   borderRadius: 50,
//   cursor: "pointer",
//   display: "flex",
//   padding: 10,
// };

// const handle = {
//   width: 20,
//   height: 20,
//   backgroundColor: "#9911ff",
//   borderRadius: "50%",
// };
