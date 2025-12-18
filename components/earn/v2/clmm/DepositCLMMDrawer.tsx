import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Pool } from "../../PoolColumn";
import { CLMMDepositTab } from "./CLMMDepositTab";
import { CLMMPositionsTab } from "./CLMMPositionsTab";

enum Tab {
  CREATE = "Create",
  POSITIONS = "Positions",
}

const tabs = [
  { label: Tab.CREATE, component: <CLMMDepositTab /> },
  { label: Tab.POSITIONS, component: <CLMMPositionsTab /> },
];

interface DepositCLMMDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPool: Pool;
}

export const DepositCLMMDrawer = ({
  isOpen,
  onOpenChange,
  selectedPool: _selectedPool,
}: DepositCLMMDrawerProps) => {
  const [activeTab, setActiveTab] = useState(Tab.CREATE);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        enableOverlay={false}
        className="bg-black-900 !top-14 !bottom-12.25 !max-w-135.75 !border-l-2 border-gray-800"
      >
        <DrawerHeader className="p-0 pl-4">
          <DrawerTitle>
            <Tabs defaultValue={Tab.CREATE}>
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.label}
                    value={tab.label}
                    className={cn(text.b3(), "px-2 py-4")}
                    onClick={() => setActiveTab(tab.label)}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </DrawerTitle>
        </DrawerHeader>
        {tabs.map((tab) => (
          <div
            className={cn(
              "transition-all outline-none",
              tab.label === activeTab ? "flex-1" : "hidden",
            )}
            key={tab.label}
          >
            {tab.component}
          </div>
        ))}
      </DrawerContent>
    </Drawer>
  );
};
