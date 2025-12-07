"use client";

import Link from "next/link";
import Discord from "@/assets/icons/socials/discord.svg";
import X from "@/assets/icons/socials/x.svg";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

export function ProModeFooter() {
  const tvl = "$13,000,000";
  const volume24h = "$0";
  const fees24h = "$0";

  return (
    <div className="bg-background fixed bottom-0 max-h-[3.0625rem] w-full">
      <div className="flex items-center justify-between border-t border-gray-800 px-8 py-3">
        <div className="flex items-center gap-8">
          <Link href="https://x.com/doxx_exchange" target="_blank">
            <X />
          </Link>
          <Link href="https://discord.gg/doxx" target="_blank">
            <Discord />
          </Link>
          <Link
            href="/docs"
            target="_blank"
            className={cn(text.sb3(), "leading-none text-gray-600")}
          >
            Docs
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className={cn(text.sb2(), "leading-none text-gray-500")}>
              TVL:{" "}
            </span>
            <span className={cn(text.b3(), "leading-none text-gray-50")}>
              {tvl}
            </span>
          </div>
          <div>
            <span className={cn(text.sb2(), "leading-none text-gray-500")}>
              24h Vol:{" "}
            </span>
            <span className={cn(text.b3(), "leading-none text-gray-50")}>
              {volume24h}
            </span>
          </div>
          <div>
            <span className={cn(text.sb2(), "leading-none text-gray-500")}>
              24h Fees:{" "}
            </span>
            <span className={cn(text.b3(), "leading-none text-gray-50")}>
              {fees24h}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
