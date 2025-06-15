"use client";

import { Button } from "./ui/button";

export function ConnectButton({ className }: { className?: string }) {
  return (
    <Button variant='connect' className={className}>
      Connect Wallet
    </Button>
  );
}
