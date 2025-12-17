"use client";

import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import { TradingMode, tradingModeAtom } from "@/lib/utils/atomWithStorage";
import { ProModeFooter } from "../swap/pro/ProModeFooter";
import { Footer } from "./Footer";

export function AppFooter() {
  return <ProModeFooter />;
  // const pathname = usePathname();
  // const [tradingMode] = useAtom(tradingModeAtom);

  // // change this to match the page(s) that need a custom footer
  // const useSpecialFooter =
  //   pathname?.startsWith("/") && tradingMode === TradingMode.PRO;

  // if (useSpecialFooter) {
  //   return <ProModeFooter />;
  // }

  // return <Footer />;
}
