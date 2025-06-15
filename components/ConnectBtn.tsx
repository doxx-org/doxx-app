"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConnectButton({ className }: { className?: string }) {
  return <Button className={cn("text-hsb2 text-green", className)}>Connect Wallet</Button>;
}
