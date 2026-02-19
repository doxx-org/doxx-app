import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { clientEnvConfig } from "@/lib/config/envConfig";

export function useRaydium({
  connection,
  wallet,
}: {
  connection: Connection | undefined;
  wallet: AnchorWallet | undefined;
}): UseQueryResult<Raydium | undefined, Error> {
  return useQuery({
    queryKey: [
      "raydium",
      connection?.rpcEndpoint,
      wallet?.publicKey?.toBase58(),
    ],
    queryFn: async () => {
      if (!connection) {
        return undefined;
      }

      return await Raydium.load({
        connection: connection,
        urlConfigs: {
          RPCS: clientEnvConfig.NEXT_PUBLIC_RPC_URL,
        },
        owner: wallet?.publicKey,
        signAllTransactions: wallet?.signAllTransactions,
      });
    },
    enabled: !!connection,
  });
}
