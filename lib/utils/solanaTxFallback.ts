import { Connection } from "@solana/web3.js";
import { CHAIN, clientEnvConfig } from "@/lib/config/envConfig";

function getFallbackRpcForEnv(): string | undefined {
  // IMPORTANT: only use Solana public fallback when we are actually on Solana.
  // For Solayer, broadcasting/confirming against Solana RPC will always fail.
  if (clientEnvConfig.NEXT_PUBLIC_CHAIN !== CHAIN.SOLANA) return undefined;
  const net = clientEnvConfig.NEXT_PUBLIC_NETWORK;
  if (net === "devnet") return "https://api.devnet.solana.com";
  return "https://api.mainnet-beta.solana.com";
}

export async function pollSignatureStatus(params: {
  connection: Connection;
  signature: string;
  timeoutMs: number;
}) {
  const { connection, signature, timeoutMs } = params;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const s0 = st.value[0];
    if (s0) {
      if (s0.err) throw new Error(JSON.stringify(s0.err));
      if (s0.confirmationStatus) return s0.confirmationStatus;
    }

    // Some RPCs don't reliably populate signature statuses. Fall back to getTransaction.
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx?.meta) {
        if (tx.meta.err) throw new Error(JSON.stringify(tx.meta.err));
        return "confirmed";
      }
    } catch {
      // ignore and continue polling
    }

    await new Promise((r) => setTimeout(r, 800));
  }
  return undefined;
}

export async function pollSignatureStatusWithFallback(params: {
  primary: Connection;
  signature: string;
  timeoutMs: number;
}) {
  const { primary, signature, timeoutMs } = params;
  const fallbackEndpoint = getFallbackRpcForEnv();
  const primaryEndpoint = primary.rpcEndpoint;

  // Try primary briefly first
  let primaryStatus: string | undefined;
  try {
    primaryStatus = await pollSignatureStatus({
      connection: primary,
      signature,
      timeoutMs: Math.min(timeoutMs, 6_000),
    });
  } catch {
    primaryStatus = undefined;
  }
  if (primaryStatus)
    return { status: primaryStatus, endpoint: primaryEndpoint ?? "primary" };

  if (!fallbackEndpoint) {
    return { status: undefined, endpoint: primaryEndpoint ?? "primary" };
  }

  // Then try fallback RPC (often what explorers effectively rely on)
  const fallback = new Connection(fallbackEndpoint, "confirmed");
  let fallbackStatus: string | undefined;
  try {
    fallbackStatus = await pollSignatureStatus({
      connection: fallback,
      signature,
      timeoutMs,
    });
  } catch {
    fallbackStatus = undefined;
  }
  if (fallbackStatus) return { status: fallbackStatus, endpoint: fallbackEndpoint };

  return { status: undefined, endpoint: primaryEndpoint ?? "primary" };
}

export async function broadcastRawTxToFallback(params: {
  rawTx: Uint8Array;
  signature: string;
}) {
  const { rawTx, signature } = params;
  const fallbackEndpoint = getFallbackRpcForEnv();
  if (!fallbackEndpoint) return;
  try {
    const fallback = new Connection(fallbackEndpoint, "confirmed");
    await fallback.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 2,
    });
    console.log("Broadcasted tx to fallback RPC:", fallbackEndpoint, signature);
  } catch (e) {
    console.warn("Failed to broadcast tx to fallback RPC:", fallbackEndpoint, e);
  }
}

