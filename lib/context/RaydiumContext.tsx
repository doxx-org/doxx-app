"use client";

import { type ReactNode, createContext, useContext } from "react";
import { Raydium as CpmmRaydium } from "@doxxorg/cpmm-sdk";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { UseQueryResult } from "@tanstack/react-query";
import { useRaydium } from "@/lib/hooks/chain/useRaydium";
import { useDoxxSDK } from "../hooks/chain/useDoxxSDK";

type RaydiumContextValue = {
  raydiumQuery: UseQueryResult<Raydium | undefined, Error>;
  cpmmRaydiumQuery: UseQueryResult<CpmmRaydium | undefined, Error>;
};

const RaydiumContext = createContext<RaydiumContextValue | null>(null);

export function RaydiumProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const raydiumQuery = useRaydium({ connection, wallet });
  const cpmmRaydiumQuery = useDoxxSDK({ connection, wallet });

  return (
    <RaydiumContext.Provider value={{ raydiumQuery, cpmmRaydiumQuery }}>
      {children}
    </RaydiumContext.Provider>
  );
}

export function useRaydiumContext(): RaydiumContextValue {
  const ctx = useContext(RaydiumContext);
  if (!ctx) {
    throw new Error("useRaydiumContext must be used inside <RaydiumProvider>");
  }
  return ctx;
}
