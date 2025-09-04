"use client";

import { HTMLAttributes, ReactNode, useCallback, useMemo } from "react";
import { WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { CopyIcon, LogOutIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { toast } from "sonner";
import ChevronDown from "@/assets/icons/chevron-down.svg";
import { useDialogState } from "@/hooks/useOpenDialog";
import { copyToClipboard, text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { ellipseAddress } from "@/utils/tokens";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ConnectButtonWrapperProps {
  className?: string;
  children?: ReactNode;
}

function ConnectWalletButton({
  className,
}: Omit<ConnectButtonWrapperProps, "button">) {
  const { isOpen, setIsOpen } = useDialogState();
  const { select, wallets, connecting } = useWallet();

  const handleConnectWallet = useCallback(
    (wallet: WalletName) => {
      try {
        select(wallet);
        toast.success("Connected wallet successfully");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        toast.error("Failed to connect to wallet, please try again");
      }
    },
    [select],
  );

  const label = useMemo(() => {
    if (connecting) return "Connecting...";
    return "Connect Wallet";
  }, [connecting]);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(text.hsb3(), className, "text-green rounded-xl")}
      >
        {label}
      </Button>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="flex max-h-[598px] min-h-[598px] w-[420px] flex-col gap-0 overflow-hidden">
            <DialogHeader className="h-fit border-b border-gray-800 py-7">
              <DialogTitle>Connect a wallet on Solana to continue</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-1 flex-col overflow-hidden overflow-y-auto px-0">
              {wallets.map((wallet, index) => (
                <div
                  key={`${wallet.adapter.name}-${index}`}
                  className="flex flex-row items-center gap-2.5 p-6 hover:cursor-pointer hover:bg-gray-800"
                  onClick={() => {
                    handleConnectWallet(wallet.adapter.name);
                  }}
                >
                  <Image
                    src={wallet.adapter.icon}
                    alt={`${wallet.adapter.name}-${index}`}
                    width={32}
                    height={32}
                  />
                  {wallet.adapter.name}
                </div>
              ))}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ConnectedWalletButton({
  publicKey,
  className,
}: ConnectButtonWrapperProps & { publicKey: string }) {
  const { disconnect } = useWallet();

  const handleDisconnectWallet = useCallback(() => {
    try {
      disconnect();
      toast.success("Disconnected wallet successfully");
    } catch (_) {
      toast.error("Failed to disconnect wallet, please try again");
    }
  }, [disconnect]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          variant="outline"
          className={cn(
            className,
            "!border-green/40 flex items-center gap-2 rounded-xl",
          )}
        >
          {ellipseAddress(publicKey.toString(), 4)}
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => publicKey && copyToClipboard(publicKey.toString())}
          >
            <CopyIcon />
            <span>Copy wallet</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-color-text-body-negative"
            onClick={handleDisconnectWallet}
          >
            <LogOutIcon className="text-color-text-body-negative" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function ConnectButtonWrapper({
  className,
  children,
}: ConnectButtonWrapperProps) {
  const { connected, publicKey, wallet } = useWallet();

  if (!connected || !publicKey || !wallet) {
    return <ConnectWalletButton className={className} />;
  }

  if (!children) {
    return (
      <ConnectedWalletButton
        className={className}
        publicKey={publicKey.toString()}
      />
    );
  }

  return <>{children}</>;
}

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export const ConnectWallet = (props: HTMLAttributes<HTMLButtonElement>) => {
  return (
    <WalletMultiButton
      {...props}
      className={cn(props.className, "text-green")}
    />
  );
};
