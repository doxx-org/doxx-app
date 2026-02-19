import { useState } from "react";
import { Pool } from "@/components/earn/v2/types";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { PoolInfo } from "../PoolInfo";
import { CPMMDepositTab } from "./CPMMDepositTab";
import { CPMMPositionsTab } from "./CPMMPositionsTab";

enum Tab {
  DEPOSIT = "Deposit",
  POSITIONS = "Positions",
}

const PoolTabs = ({
  activeTab,
  selectedPool,
}: {
  activeTab: Tab;
  selectedPool: Pool;
}) => {
  if (activeTab === Tab.DEPOSIT) {
    return <CPMMDepositTab selectedPool={selectedPool} />;
  }

  return <CPMMPositionsTab />;
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
        <PoolInfo {...selectedPool} raydium={undefined} />
        <PoolTabs activeTab={activeTab} selectedPool={selectedPool} />
      </DrawerContent>
    </Drawer>
  );
};
