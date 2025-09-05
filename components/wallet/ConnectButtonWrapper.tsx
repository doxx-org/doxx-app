"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { CopyIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import ChevronDown from "@/assets/icons/chevron-down.svg";
import { useDialogState } from "@/hooks/useOpenDialog";
import { copyToClipboard, text } from "@/lib/text";
import { cn } from "@/lib/utils";
import { simplifyErrorMessage } from "@/utils/error";
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

interface ConnectWalletButtonProps
  extends Omit<ConnectButtonWrapperProps, "children"> {
  selectedWalletRef: React.RefObject<WalletName | null>;
  connectionAttemptRef: React.RefObject<boolean>;
  onConnectionSuccess?: () => void;
}

function ConnectWalletButton({
  className,
  selectedWalletRef,
  connectionAttemptRef,
  onConnectionSuccess,
}: ConnectWalletButtonProps) {
  const { isOpen, setIsOpen } = useDialogState();
  const { select, wallets, connecting, connected } = useWallet();

  // Handle successful connection and close dialog
  useEffect(() => {
    if (
      connected &&
      selectedWalletRef.current &&
      connectionAttemptRef.current
    ) {
      // Close the dialog
      setIsOpen(false);
      onConnectionSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, setIsOpen, onConnectionSuccess]);

  const handleConnectWallet = useCallback(
    (wallet: WalletName) => {
      try {
        // Set refs to track this connection attempt
        selectedWalletRef.current = wallet;
        connectionAttemptRef.current = true;

        select(wallet);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // Reset refs on error
        selectedWalletRef.current = null;
        connectionAttemptRef.current = false;

        toast.error(
          simplifyErrorMessage(
            error,
            "Failed to connect wallet, please try again",
          ),
        );
      }
    },
    [select, selectedWalletRef, connectionAttemptRef],
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(
        simplifyErrorMessage(
          error,
          "Failed to disconnect wallet, please try again",
        ),
      );
    }
  }, [disconnect]);

  const handleCopyWallet = useCallback(() => {
    if (publicKey) {
      copyToClipboard(publicKey.toString());
    }
  }, [publicKey]);

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
          <DropdownMenuItem onClick={handleCopyWallet}>
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
  const { connected, publicKey, wallet, connecting } = useWallet();
  const selectedWalletRef = useRef<WalletName | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);

  // Handle successful connection
  useEffect(() => {
    if (
      connected &&
      publicKey &&
      selectedWalletRef.current &&
      connectionAttemptRef.current
    ) {
      const walletName = selectedWalletRef.current;
      toast.success(
        <div className="flex flex-col gap-0.5">
          <span>
            Successfully connected to {ellipseAddress(publicKey.toString(), 4)}
          </span>
          <span>with {walletName} wallet</span>
        </div>,
      );

      // Reset refs
      selectedWalletRef.current = null;
      connectionAttemptRef.current = false;
    }
  }, [connected, publicKey]);

  // Reset connection attempt if user cancels or connection fails
  useEffect(() => {
    if (!connecting && connectionAttemptRef.current && !connected) {
      // Connection was attempted but failed or was cancelled
      const walletName = selectedWalletRef.current;

      // Only show error if we have a wallet name (connection was actually attempted)
      if (walletName) {
        toast.error(`Failed to connect to ${walletName}. Please try again.`);
      }

      // Reset refs
      connectionAttemptRef.current = false;
      selectedWalletRef.current = null;
    }
  }, [connecting, connected, connectionAttemptRef, selectedWalletRef]);

  if (!connected || !publicKey || !wallet) {
    return (
      <ConnectWalletButton
        className={className}
        selectedWalletRef={selectedWalletRef}
        connectionAttemptRef={connectionAttemptRef}
      />
    );
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
