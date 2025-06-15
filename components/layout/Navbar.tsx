"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@/components/ConnectBtn";
import DoxxIcon from "@/assets/icons/doxx-icon.svg";
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

  return (
    <nav className='bg-background w-full'>
      <div className='mx-auto px-6 py-2 w-full'>
        <div className='flex items-center gap-12 justify-between'>
          <div className='flex items-center gap-12'>
            <DoxxIcon />

            {/* Desktop navigation */}
            <div className='hidden md:flex md:items-center space-x-9'>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "text-b3 text-gray-500 hover:text-gray-50",
                    item.href === "/" && "text-gray-50"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className='flex items-center gap-4'>
            <TradingToggle />
            <ConnectButton className='text-hsb2' />
          </div>

          {/* Mobile menu button */}
          <div className='flex md:hidden'>
            <button
              type='button'
              className='inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted'
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className='sr-only'>Open main menu</span>
              {mobileMenuOpen ? (
                <X className='block h-6 w-6' aria-hidden='true' />
              ) : (
                <Menu className='block h-6 w-6' aria-hidden='true' />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={
          cn("md:hidden", mobileMenuOpen ? "block" : "hidden") +
          " bg-background border-t border-border"
        }
      >
        <div className='space-y-1 px-2 pb-3 pt-2'>
          <button className='flex items-center text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium w-full text-left'>
            Swap <ChevronDown className='ml-1 h-4 w-4' />
          </button>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className='block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className='flex items-center space-x-2 mt-2'>
            {/* <ModeToggle /> */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
