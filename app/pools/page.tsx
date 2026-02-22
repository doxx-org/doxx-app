"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import Plus from "@/assets/icons/table/plus.svg";
import { Pools } from "@/components/earn";
import { CreatePoolDialog } from "@/components/earn/v2/CreatePoolDialog";
import { PoolType } from "@/components/earn/v2/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RawTokenProfile, knownTokenProfiles } from "@/lib/config/tokens";
// import { useDoxxCpmmProgram } from "@/lib/hooks/chain/useDoxxCpmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetAllTokenInfos } from "@/lib/hooks/chain/useGetAllTokenInfos";
// import { useGetCPMMPools } from "@/lib/hooks/chain/useGetCPMMPools";
// import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useAllSplBalances } from "@/lib/hooks/chain/useSplBalance";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

export default function Home() {
  const [poolDrawer, setPoolDrawer] = useState<PoolType>(PoolType.CLMM);
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);

  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Fetch all pools
  const {
    data: allPools,
    // isLoading: isLoadingAllPools,
    // refetch,
    cpmmPoolsData,
    clmmPoolsData,
  } = useGetAllPools();

  // Fetch token balances
  const { data: splBalances } = useAllSplBalances(
    connection,
    wallet?.publicKey ?? undefined,
    knownTokenProfiles,
    true,
  );

  const rawTokenProfilesFromSplBalances: RawTokenProfile[] | undefined =
    useMemo(() => {
      if (!splBalances) return undefined;

      const allBalances = Object.values(splBalances).filter((c) => !!c);

      return allBalances.map((b) => {
        return {
          address: b.mint,
          decimals: b.decimals,
        };
      });
    }, [splBalances]);

  const poolTokens = useMemo(() => {
    return allPools?.map((p) => {
      return {
        mint0Address: p.lpToken.token1.address,
        mint0Decimals: p.lpToken.token1.decimals,
        mint1Address: p.lpToken.token2.address,
        mint1Decimals: p.lpToken.token2.decimals,
      };
    });
  }, [allPools]);

  const { data: allTokenProfiles, isLoading: isLoadingAllTokenProfiles } =
    useGetAllTokenInfos({
      poolTokens,
      rawTokenProfiles: rawTokenProfilesFromSplBalances,
    });

  const handleOpenCreateCLMMPoolDialog = () => {
    setIsCreatePoolOpen(true);
    setPoolDrawer(PoolType.CLMM);
  };

  const handleOpenCreateCPMMDrawer = () => {
    setIsCreatePoolOpen(true);
    setPoolDrawer(PoolType.CPMM);
  };

  return (
    <div className="flex min-h-screen justify-center gap-16 p-8 sm:p-20 sm:pt-26">
      <div className="flex w-[1336px] flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className={cn(text.it1(), "text-green")}>All Pools</h1>
          <div
            className={cn(
              text.b3(),
              "text-green flex flex-row items-center gap-2.5",
            )}
          >
            <div
              className="bg-green/20 flex h-10.5 cursor-not-allowed flex-row items-center justify-center gap-2.5 rounded-2xl p-4 px-5"
              // className="hover:bg-green/50 bg-green/30 flex h-10.5 cursor-not-allowed flex-row items-center justify-center gap-2.5 rounded-2xl p-4 px-5"
              // TODO: add create token dialog
              // onClick={() => {}}
            >
              <Plus />
              Create Token
            </div>
            <div
              className={cn(
                text.b3(),
                "text-green flex flex-row items-center gap-0.5",
              )}
            >
              <div
                className={cn(
                  "hover:bg-green/50 bg-green/30 flex h-10.5 flex-row items-center justify-center gap-2.5 rounded-l-2xl rounded-r-none p-4 px-5 hover:cursor-pointer",
                )}
                onClick={handleOpenCreateCLMMPoolDialog}
              >
                <Plus />
                Create Pool
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="hover:bg-green/50 text-green bg-green/30 h-10.5 rounded-l-none rounded-r-2xl p-4 hover:cursor-pointer">
                  <ChevronDown className="text-green stroke-green h-3 w-1.25" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleOpenCreateCLMMPoolDialog}>
                    Create CLMM Pool
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleOpenCreateCPMMDrawer}
                    disabled
                  >
                    Create CPMM Pool
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {/* <MyDeposit /> */}
        <Pools />
      </div>
      {/* Create Pool Dialog */}
      {isCreatePoolOpen && !isLoadingAllTokenProfiles && allTokenProfiles && (
        <CreatePoolDialog
          isOpen={isCreatePoolOpen}
          createPoolType={poolDrawer}
          splBalances={splBalances}
          allTokenProfiles={allTokenProfiles}
          onOpenChange={setIsCreatePoolOpen}
          poolsData={
            poolDrawer === PoolType.CPMM ? cpmmPoolsData : clmmPoolsData
          }
        />
      )}
    </div>
  );
}
