import { MyDeposit, Pools } from "@/components/earn";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center gap-16 p-8 sm:p-20">
      <div className="flex w-[1336px] flex-col gap-12">
        <MyDeposit />
        <Pools />
      </div>
    </div>
  );
}
