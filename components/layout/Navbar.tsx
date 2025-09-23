"use client";

import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DoxxIcon from "@/assets/icons/doxx-icon.svg";
import { ConnectButtonWrapper } from "@/components/wallet/ConnectButtonWrapper";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import TradingToggle from "../TradingToggle";

const navigation = [
  { name: "Explore", href: "/explore" },
  { name: "Trade", href: "/" },
  { name: "Earn", href: "/earn" },
  { name: "Launch", href: "/launch" },
  { name: "Portfolio", href: "/portfolio" },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="bg-background text-it5 w-full">
      <div className="mx-auto w-full px-6 py-2">
        <div className="flex items-center justify-between gap-12">
          <div className="flex items-center gap-12">
            <DoxxIcon />
            {/* Desktop navigation */}
            <div className="hidden space-x-9 md:flex md:items-center">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    text.b3(),
                    "text-gray-500",
                    pathname === item.href && "text-gray-50",
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <TradingToggle />
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
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-2 flex items-center space-x-2">
            {/* <ModeToggle /> */}
            <ConnectButtonWrapper />
          </div>
        </div>
      </div>
    </nav>
  );
}
