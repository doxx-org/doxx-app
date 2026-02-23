import { useState } from "react";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDoxxClmmProgram } from "@/lib/hooks/chain/useDoxxClmmProgram";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetUserClmmPositions } from "@/lib/hooks/chain/useGetUserClmmPositions";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useRaydium } from "@/lib/hooks/chain/useRaydium";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { PoolInfo } from "../../PoolInfo";
import { Pool } from "../../types";
import { CLMMPositionsTab } from "../positions/CLMMPositionsTab";
import { CLMMDepositTab } from "./CLMMDepositTab";

enum Tab {
  DEPOSIT = "Deposit",
  POSITIONS = "Positions",
}

const PoolTabs = ({
  activeTab,
  selectedPool,
  raydium,
}: {
  activeTab: Tab;
  selectedPool: Pool;
  raydium: Raydium | undefined;
}) => {
  // Hooks
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxClmmProgram = useDoxxClmmProgram({ provider });
  const { data: allPools } = useGetAllPools();

  const {
    data: allPositions,
    isLoading: isLoadingAllPositions,
    refetch: refetchAllPositions,
  } = useGetUserClmmPositions(doxxClmmProgram, wallet?.publicKey, allPools);

  if (activeTab === Tab.DEPOSIT) {
    return (
      <CLMMDepositTab
        selectedPool={selectedPool}
        raydium={raydium}
        onDepositSuccess={() => refetchAllPositions()}
      />
    );
  }

  return (
    <CLMMPositionsTab
      selectedPool={selectedPool}
      raydium={raydium}
      positions={allPositions}
      isLoadingPositions={isLoadingAllPositions}
      allPools={allPools}
    />
  );
};

interface DepositCLMMDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPool: Pool;
}

export const DepositCLMMDrawer = ({
  isOpen,
  onOpenChange,
  selectedPool,
}: DepositCLMMDrawerProps) => {
  const [activeTab, setActiveTab] = useState(Tab.DEPOSIT);
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Initialize Raydium SDK
  const { data: raydium } = useRaydium({ connection, wallet });

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        enableOverlay={false}
        className="bg-black-900 !top-14 !bottom-12.25 !max-w-135.75 overflow-hidden !border-l-2 border-gray-800"
      >
        <DrawerHeader className="shrink-0 border-b border-gray-800 p-0 pl-4">
          <DrawerTitle>
            <Tabs defaultValue={Tab.DEPOSIT}>
              <TabsList>
                {Object.values(Tab).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className={cn(text.b3(), "px-2 py-4 leading-[18px]")}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </DrawerTitle>
        </DrawerHeader>
        {/* <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PoolInfo {...selectedPool} raydium={raydium} /> */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PoolTabs
            activeTab={activeTab}
            selectedPool={selectedPool}
            raydium={raydium}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
