"use client";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function ConnectButton({ className }: { className?: string }) {
  return (
    <Button className={cn(className, "text-green")}>Connect Wallet</Button>
  );
}
