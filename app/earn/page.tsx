import { MyDeposit, Pools } from "@/components/earn";

export default function Home() {
  return (
    <div className='flex justify-center min-h-screen p-8  gap-16 sm:p-20'>
      <div className='flex flex-col gap-12 w-[1336px]'>
        <MyDeposit />
        <Pools />
      </div>
    </div>
  );
}
