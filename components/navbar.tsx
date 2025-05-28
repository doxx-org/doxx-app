"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ConnectButton } from "@/components/connect-button";

const navigation = [
  { name: "Explore", href: "/explore" },
  { name: "Liquidity", href: "/liquidity" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "eUMBRA", href: "/eumbra" },
  { name: "Expedition", href: "/expedition" },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className='bg-background border-b border-border'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 justify-between items-center'>
          {/* Logo */}
          <div className='flex items-center space-x-2'>
            <span className='w-7 h-7 rounded-full bg-gradient-to-br from-chart-4 via-chart-3 to-chart-1 flex items-center justify-center mr-2' />
            <span className='text-lg font-bold tracking-wide text-foreground'>UMBRA</span>
            <Badge variant='secondary' className='ml-1 px-2 py-0.5 rounded text-xs font-semibold'>
              V2
            </Badge>
          </div>

          {/* Desktop navigation */}
          <div className='hidden md:flex md:items-center md:space-x-2 lg:space-x-6'>
            {/* Swap with dropdown arrow */}
            <button className='flex items-center text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium focus:outline-none'>
              Swap <ChevronDown className='ml-1 h-4 w-4' />
            </button>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className='text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium'
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side: ModeToggle and Connect Wallet */}
          <div className='hidden md:flex items-center space-x-2'>
            <ModeToggle />
            <ConnectButton />
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
            <ModeToggle />
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
