"use client";

import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DoxxIcon from "@/assets/icons/doxx-icon.svg";
import { ConnectButtonWrapper } from "@/components/wallet/ConnectButtonWrapper";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
// import TradingToggle from "../TradingToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface SingleNavigationItem {
  name: string;
  href: string;
  disabled?: boolean;
}

interface NavigationItem extends Omit<SingleNavigationItem, "href"> {
  name: string;
  href?: string;
  subItems?: SingleNavigationItem[];
  disabled?: boolean;
}

const navigations: NavigationItem[] = [
  // { name: "Explore", href: "/explore" },
  { name: "Trade", href: "/" },
  {
    name: "Earn",
    subItems: [
      { name: "Pools", href: "/pools" },
      { name: "Harvest", href: "/harvest", disabled: true },
    ],
  },
  // { name: "Launch", href: "/launch" },
  // { name: "Portfolio", href: "/portfolio" },
];

interface MultipleMenuItemProps extends Omit<SingleNavigationItem, "href"> {
  href?: string;
  subItems?: SingleNavigationItem[];
}

const SingleMenuItem = ({
  name,
  href,
}: Omit<SingleNavigationItem, "disabled">) => {
  const pathname = usePathname();
  return (
    <Link
      className={cn("hover:text-green", pathname === href ? "text-green" : "")}
      href={href}
    >
      {name}
    </Link>
  );
};

const MultipleMenuItem = ({
  name,
  subItems,
}: Omit<MultipleMenuItemProps, "disabled" | "href">) => {
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:text-green flex flex-row items-center gap-0.5",
          subItems?.some((subItem) => pathname === subItem.href)
            ? "text-green"
            : "",
        )}
      >
        {name}
        <ChevronDown className="h-3 w-1.25" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="flex flex-col gap-1">
        {subItems?.map((subItem) => {
          if (subItem.disabled) {
            return null;
          }
          return (
            <Link
              key={subItem.name}
              href={subItem.href}
              className={cn(
                "hover:text-green",
                pathname === subItem.href ? "text-green" : "",
              )}
            >
              <DropdownMenuItem>{subItem.name}</DropdownMenuItem>
            </Link>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-background text-it5 fixed top-0 z-50 max-h-14 w-full border-b border-gray-800">
      <div className="mx-auto w-full px-6 py-2">
        <div className="flex items-center justify-between gap-12">
          <div className="flex items-center gap-12">
            <DoxxIcon />
            {/* Desktop navigation */}
            <div
              className={cn(
                text.b3(),
                "hidden space-x-9 md:flex md:items-center",
              )}
            >
              {navigations.map((navItem) => {
                if (
                  navItem.subItems &&
                  navItem.subItems.length > 0 &&
                  !navItem.disabled
                ) {
                  return (
                    <MultipleMenuItem
                      key={navItem.name}
                      name={navItem.name}
                      subItems={navItem.subItems}
                    />
                  );
                }

                if (!navItem.href || navItem.disabled) {
                  return;
                }

                return (
                  <SingleMenuItem
                    key={navItem.name}
                    name={navItem.name}
                    href={navItem.href}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* <TradingToggle /> */}
            <ConnectButtonWrapper className={cn(text.hsb3())} />
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center justify-center rounded-md p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={
          cn("md:hidden", mobileMenuOpen ? "block" : "hidden") +
          " bg-background border-border border-t"
        }
      >
        <div className="space-y-1 px-2 pt-2 pb-3">
          <button className="text-muted-foreground hover:text-foreground flex w-full items-center px-3 py-2 text-left text-sm font-medium">
            Swap <ChevronDown className="ml-1 h-4 w-4" />
          </button>
          {navigations.map((navItem) => {
            if (navItem.subItems) {
              return (
                <MultipleMenuItem
                  key={navItem.name}
                  name={navItem.name}
                  subItems={navItem.subItems}
                />
              );
            }
            if (!navItem.href || navItem.disabled) {
              return null;
            }
            return (
              <SingleMenuItem
                key={navItem.name}
                name={navItem.name}
                href={navItem.href}
              />
            );
          })}
          <div className="mt-2 flex items-center space-x-2">
            {/* <ModeToggle /> */}
            <ConnectButtonWrapper />
          </div>
        </div>
      </div>
    </nav>
  );
}
