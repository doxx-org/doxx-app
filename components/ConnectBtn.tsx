"use client";

import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function ConnectButton({ className }: { className?: string }) {
  return (
    <Button variant='connect' className={cn(className, "text-green")}>
      Connect Wallet
    </Button>
  );
}
