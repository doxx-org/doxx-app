import { TrendingTokens, SwapWidget } from "@/components/swap";

export default function Home() {
  return (
    <div className='flex justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20'>
      <div className='flex flex-col gap-3 w-[468px]'>
        <TrendingTokens />
        <SwapWidget />
      </div>
    </div>
  );
}
