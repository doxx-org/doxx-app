import { z } from "zod";

export enum APP_ENV {
  PROD = "prod",
  STG = "stg",
  DEV = "dev",
}

export enum APP_NETWORK {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  DEVNET = "devnet",
}

const APP_ENV_VALUES: APP_ENV[] = Object.values(APP_ENV).reduce(
  (acc, value) => {
    acc.push(value as APP_ENV);
    return acc;
  },
  [] as APP_ENV[],
);

const APP_NETWORK_VALUES: APP_NETWORK[] = Object.values(APP_NETWORK).reduce(
  (acc, value) => {
    acc.push(value as APP_NETWORK);
    return acc;
  },
  [] as APP_NETWORK[],
);

const envSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENV_VALUES),
  NEXT_PUBLIC_NETWORK: z.enum(APP_NETWORK_VALUES),
  NEXT_PUBLIC_RPC_URL: z.url(),
});

/**
 * Next.js replaces process.env.NEXT_PUBLIC_* at build time.
 * We pass a minimal object to avoid reading non-public keys on the client.
 */
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
});

if (!parsed.success) {
  const format = z.treeifyError(parsed.error).properties;
  if (format) {
    console.error(
      "❌ Some of these client environment variables are missing or invalid:",
      format,
    );
  }
  throw new Error(
    "Invalid client environment variables. See logs for details.",
  );
}

export const clientEnvConfig = parsed.data;
export type ClientEnvConfig = typeof clientEnvConfig;
