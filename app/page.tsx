import { SwapWidget, TrendingTokens } from "@/components/swap";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center gap-16 p-8 sm:p-20">
      <div className="flex w-[468px] flex-col gap-3">
        <TrendingTokens />
        <SwapWidget />
      </div>
    </div>
  );
}
