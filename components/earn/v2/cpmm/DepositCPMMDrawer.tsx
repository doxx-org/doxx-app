import { useCallback, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Pool } from "@/components/earn/v2/types";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRaydiumContext } from "@/lib/context/RaydiumContext";
import { useGetAllPools } from "@/lib/hooks/chain/useGetAllPools";
import { useGetUserCPMMPositions } from "@/lib/hooks/chain/useGetUserCpmmPositions";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { CPMMDepositTab } from "./CPMMDepositTab";
import { CPMMPositionsTab } from "./CPMMPositionsTab";

enum Tab {
  DEPOSIT = "Deposit",
  POSITIONS = "Positions",
}

interface PoolTabsProps {
  activeTab: Tab;
  selectedPool: Pool;
}

const PoolTabs = ({ activeTab, selectedPool }: PoolTabsProps) => {
  const wallet = useAnchorWallet();
  const {
    cpmmRaydiumQuery: { data: raydium, refetch: refetchCpmmRaydium },
  } = useRaydiumContext();
  const { data: allPools, refetch: refetchAllPools } = useGetAllPools();

  const {
    data: allPositions,
    isLoading: isLoadingAllPositions,
    refetch: refetchAllPositions,
  } = useGetUserCPMMPositions(raydium, wallet?.publicKey, allPools);

  const handleCTAPositionSuccess = useCallback(() => {
    refetchAllPools();
    refetchAllPositions();
    refetchCpmmRaydium();
  }, [refetchAllPools, refetchAllPositions, refetchCpmmRaydium]);

  if (activeTab === Tab.DEPOSIT) {
    return (
      <CPMMDepositTab
        selectedPool={selectedPool}
        raydium={raydium}
        onDepositSuccess={handleCTAPositionSuccess}
      />
    );
  }

  return (
    <CPMMPositionsTab
      selectedPool={selectedPool}
      raydium={raydium}
      positions={allPositions}
      isLoadingPositions={isLoadingAllPositions}
      allPools={allPools}
      onPositionCTASuccess={handleCTAPositionSuccess}
    />
  );
};

interface DepositCPMMDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPool: Pool;
}

export const DepositCPMMDrawer = ({
  isOpen,
  onOpenChange,
  selectedPool,
}: DepositCPMMDrawerProps) => {
  const [activeTab, setActiveTab] = useState(Tab.DEPOSIT);
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        enableOverlay={false}
        className="bg-black-900 !top-14 !bottom-12.25 !max-w-135.75 !border-l-2 border-gray-800"
      >
        <DrawerHeader className="border-b border-gray-800 p-0 pl-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PoolTabs activeTab={activeTab} selectedPool={selectedPool} />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
